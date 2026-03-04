import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Upload, 
  Download, 
  MapPin, 
  Calendar, 
  Smartphone, 
  Info, 
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { getExifFromBase64, updateExifGps, updateExifFields, formatExifDate, getRandomMinute, type ExifData } from '@/lib/exif-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// 图片数据接口
interface ImageData {
  id: string;
  file: File;
  base64: string;
  exifData: ExifData | null;
  isModified: boolean;
}

// 表单验证模式
const exifFormSchema = z.object({
  // GPS 修改开关
  modifyGPS: z.boolean(),
  latitude: z.union([z.number(), z.null()]).optional(),
  longitude: z.union([z.number(), z.null()]).optional(),
  
  // 设备信息修改开关
  modifyDevice: z.boolean(),
  make: z.string().optional(),
  model: z.string().optional(),
  
  // 时间修改开关
  modifyDateTime: z.boolean(),
  dateOnly: z.string().optional(),
  hourOnly: z.string().optional(),
  minuteOnly: z.string().optional(),
  
  applyToAll: z.boolean(),
});

interface ExifFormValues {
  modifyGPS: boolean;
  latitude?: number | null;
  longitude?: number | null;
  
  modifyDevice: boolean;
  make?: string;
  model?: string;
  
  modifyDateTime: boolean;
  dateOnly?: string;
  hourOnly?: string;
  minuteOnly?: string;
  
  applyToAll: boolean;
}

const Home: React.FC = () => {
  const [images, setImages] = useState<ImageData[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [isAndroidMobile, setIsAndroidMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 检测是否为安卓手机
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);
    const isMobile = /mobile/.test(ua);
    setIsAndroidMobile(isAndroid && isMobile);
  }, []);

  const form = useForm<ExifFormValues>({
    resolver: zodResolver(exifFormSchema),
    defaultValues: {
      modifyGPS: false,
      latitude: null,
      longitude: null,
      modifyDevice: false,
      make: '',
      model: '',
      modifyDateTime: false,
      dateOnly: '',
      hourOnly: '08',
      minuteOnly: '',
      applyToAll: false,
    },
  });

  const currentImage = images[currentImageIndex] || null;

  // 处理图片上传（支持多文件）
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const processFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/jpeg')) {
        toast.error(`${file.name} 不是 JPEG 格式，已跳过`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      toast.error('没有有效的 JPEG/JPG 图片');
      return;
    }

    const newImages: ImageData[] = [];
    let processed = 0;

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        
        let exifData: ExifData | null = null;
        try {
          exifData = getExifFromBase64(base64);
        } catch (error) {
          console.error(`EXIF Parsing Error for ${file.name}:`, error);
        }

        newImages.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          base64,
          exifData,
          isModified: false,
        });

        processed++;
        if (processed === validFiles.length) {
          setImages(prev => {
            const nextIndex = prev.length;
            setCurrentImageIndex(nextIndex);
            
            // 更新表单为第一张新图片的数据
            if (newImages[0]?.exifData) {
              const data = newImages[0].exifData;
              let dateVal = '';
              let hourVal = '08';
              let minuteVal = '';
              
              const rawDateTime = data.formatted["拍摄时间"];
              if (rawDateTime && typeof rawDateTime === 'string') {
                const parts = rawDateTime.split(' ');
                if (parts.length === 2) {
                  dateVal = parts[0].replace(/:/g, '-');
                  const timeParts = parts[1].split(':');
                  if (timeParts.length >= 2) {
                    hourVal = timeParts[0];
                    minuteVal = timeParts[1];
                  }
                }
              }

              form.reset({
                modifyGPS: false,
                latitude: data.gps.latitude,
                longitude: data.gps.longitude,
                modifyDevice: false,
                make: data.formatted["设备厂家"] || '',
                model: data.formatted["设备型号"] || '',
                modifyDateTime: false,
                dateOnly: dateVal,
                hourOnly: hourVal,
                minuteOnly: minuteVal,
                applyToAll: false,
              });
            }
            
            return [...prev, ...newImages];
          });
          toast.success(`成功加载 ${validFiles.length} 张图片`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // 拖拽处理
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  // 提交修改
  const onSubmit = (values: ExifFormValues) => {
    if (images.length === 0) return;

    try {
      const applyToAll = values.applyToAll;
      const indicesToUpdate = applyToAll ? images.map((_, i) => i) : [currentImageIndex];
      const updatedImages = [...images];
      
      let skippedTimeCount = 0;
      let usedDefaultTimeCount = 0;

      indicesToUpdate.forEach(index => {
        let updatedBase64 = updatedImages[index].base64;
        const originalExif = updatedImages[index].exifData;
        
        // 1. 更新 GPS (仅在勾选 modifyGPS 时)
        if (values.modifyGPS) {
          updatedBase64 = updateExifGps(updatedBase64, values.latitude ?? null, values.longitude ?? null);
        }
        
        // 2. 更新其他字段
        const fieldUpdates: Record<string, string | null> = {};
        
        // 更新设备信息 (仅在勾选 modifyDevice 时)
        if (values.modifyDevice) {
          fieldUpdates.make = values.make || "";
          fieldUpdates.model = values.model || "";
        }
        
        // 更新日期时间 (仅在勾选 modifyDateTime 时)
        if (values.modifyDateTime) {
          const hasOriginalTime = !!originalExif?.formatted["拍摄时间"];
          
          if (!hasOriginalTime) {
            skippedTimeCount++;
          } else if (values.dateOnly) {
            let finalHour = values.hourOnly || "08";
            let finalMinute = values.minuteOnly;
            
            if (!finalMinute) {
              finalMinute = getRandomMinute();
              usedDefaultTimeCount++;
            }
            
            fieldUpdates.dateTime = formatExifDate(values.dateOnly, finalHour, finalMinute);
          }
        }
        
        updatedBase64 = updateExifFields(updatedBase64, fieldUpdates);
        
        // 重新读取以更新 UI
        const newData = getExifFromBase64(updatedBase64);
        
        updatedImages[index] = {
          ...updatedImages[index],
          base64: updatedBase64,
          exifData: newData,
          isModified: true,
        };
      });

      setImages(updatedImages);
      
      let msg = applyToAll ? `已成功处理 ${images.length} 张图片。` : '已成功保存当前图片修改。';
      if (skippedTimeCount > 0) {
        msg += ` 提示：有 ${skippedTimeCount} 张图片因缺少原始时间信息被跳过时间修改。`;
      }
      if (usedDefaultTimeCount > 0) {
        msg += ` 提示：有 ${usedDefaultTimeCount} 张图片使用了默认时间（08:${getRandomMinute()} 等）。`;
      }
      
      toast.info(msg, { duration: 5000 });
    } catch (error) {
      console.error('Update Error:', error);
      toast.error('修改 EXIF 信息失败');
    }
  };

  // 下载单张图片
  const downloadSingleImage = (index: number) => {
    const img = images[index];
    if (!img) return;
    
    const link = document.createElement('a');
    link.href = img.base64;
    link.download = `已修改_${img.file.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('图片已开始下载');
  };

  // 批量下载（ZIP）
  const downloadAllImages = async () => {
    if (images.length === 0) return;

    try {
      const zip = new JSZip();
      
      images.forEach((img, index) => {
        const base64Data = img.base64.split(',')[1];
        zip.file(`已修改_${img.file.name}`, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `EXIF已编辑图片_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`已打包 ${images.length} 张图片并开始下载`);
    } catch (error) {
      console.error('ZIP Error:', error);
      toast.error('打包下载失败');
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    
    if (currentImageIndex >= newImages.length) {
      setCurrentImageIndex(Math.max(0, newImages.length - 1));
    }
    
    toast.success('图片已移除');
  };

  const removeAllImages = () => {
    setImages([]);
    setCurrentImageIndex(0);
    form.reset();
    toast.success('已清空所有图片');
  };

  // 切换当前图片
  const switchToImage = (index: number) => {
    setCurrentImageIndex(index);
    const img = images[index];
    if (img?.exifData) {
      // 解析日期时间
      let dateVal = '';
      let hourVal = '08';
      let minuteVal = '';
      
      const rawDateTime = img.exifData.formatted["拍摄时间"];
      if (rawDateTime && typeof rawDateTime === 'string') {
        const parts = rawDateTime.split(' ');
        if (parts.length === 2) {
          dateVal = parts[0].replace(/:/g, '-');
          const timeParts = parts[1].split(':');
          if (timeParts.length >= 2) {
            hourVal = timeParts[0];
            minuteVal = timeParts[1];
          }
        }
      }

      form.reset({
        modifyGPS: false,
        latitude: img.exifData.gps.latitude,
        longitude: img.exifData.gps.longitude,
        modifyDevice: false,
        make: img.exifData.formatted["设备厂家"] || '',
        model: img.exifData.formatted["设备型号"] || '',
        modifyDateTime: false,
        dateOnly: dateVal,
        hourOnly: hourVal,
        minuteOnly: minuteVal,
        applyToAll: false,
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col items-center justify-center space-y-4 text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          图片 <span className="text-primary font-black">EXIF</span> 编辑器
        </h1>
        <p className="text-xl text-muted-foreground max-w-[700px]">
          查看、编辑和修复您的照片元数据。支持批量处理，保护您的位置隐私或记录重要的拍摄信息。
        </p>
      </div>

      {images.length === 0 ? (
        <div 
          className="flex flex-col items-center justify-center border-4 border-dashed border-muted-foreground/25 rounded-2xl p-20 transition-all hover:bg-muted/50 hover:border-primary/50 cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="p-6 rounded-full bg-primary/10 mb-6 group-hover:scale-110 transition-transform">
            <Upload className="w-12 h-12 text-primary" />
          </div>
          <h3 className="text-2xl font-semibold mb-2">点击或拖拽图片到这里</h3>
          <p className="text-muted-foreground mb-4">支持 JPG, JPEG 格式 · 支持批量上传</p>
          
          {/* 红色提示 - 仅在安卓手机端显示 */}
          {isAndroidMobile && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-950/20 border-2 border-red-500 rounded-lg max-w-md">
              <p className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>推荐使用夸克、UC 等浏览器，可直接读取完整图片信息！</span>
              </p>
            </div>
          )}
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/jpeg,image/jpg" 
            multiple
            className="hidden" 
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* 左侧图片列表 */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="h-[750px] flex flex-col">
              <CardHeader className="py-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-md flex items-center gap-2">
                    <Layers className="w-4 h-4" /> 图片列表 ({images.length})
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={removeAllImages} className="h-8 w-8 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <Separator />
              <ScrollArea className="flex-1 p-2">
                <div className="space-y-2">
                  {images.map((img, index) => (
                    <div 
                      key={img.id}
                      onClick={() => switchToImage(index)}
                      className={`relative group cursor-pointer p-2 rounded-lg border-2 transition-all flex gap-3 items-center ${
                        currentImageIndex === index ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'
                      }`}
                    >
                      <div className="w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                        <img src={img.base64} alt={img.file.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{img.file.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(img.file.size / 1024).toFixed(0)} KB
                        </p>
                        {img.isModified && (
                          <Badge variant="secondary" className="text-[8px] h-4 py-0 px-1 mt-1 bg-green-500/10 text-green-600 border-green-200">
                            已修改
                          </Badge>
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 right-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(index);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button 
                    variant="outline" 
                    className="w-full h-16 border-dashed mt-2" 
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" /> 继续添加
                  </Button>
                </div>
              </ScrollArea>
              <Separator />
              <div className="p-4">
                 <Button className="w-full" onClick={downloadAllImages} variant="secondary">
                   <Download className="w-4 h-4 mr-2" /> 批量下载 ZIP
                 </Button>
              </div>
            </Card>
          </div>

          {/* 中间预览 */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="overflow-hidden border-2 shadow-lg h-fit sticky top-24">
              <div className="aspect-square bg-muted relative flex items-center justify-center overflow-hidden">
                {currentImage && (
                  <img 
                    src={currentImage.base64} 
                    alt="Preview" 
                    className="max-w-full max-h-full object-contain shadow-2xl" 
                  />
                )}
              </div>
              <CardContent className="p-4 bg-muted/30">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-muted-foreground flex items-center gap-1 truncate max-w-[200px]">
                    <ImageIcon className="w-4 h-4" /> {currentImage?.file.name}
                  </span>
                  <Badge variant="outline">{(currentImage!.file.size / (1024 * 1024)).toFixed(2)} MB</Badge>
                </div>
              </CardContent>

              <Separator />
              
              <div className="p-4 space-y-3">
                 <h4 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-wider">
                   <Info className="w-4 h-4 text-primary" /> 当前元数据
                 </h4>
                 <div className="max-h-[300px] overflow-auto border rounded-lg">
                    <Table>
                        <TableBody>
                            {currentImage?.exifData ? Object.entries(currentImage.exifData.formatted).map(([key, value]) => (
                                <TableRow key={key}>
                                    <TableCell className="font-medium text-xs text-muted-foreground py-2 px-3">{key}</TableCell>
                                    <TableCell className="text-right text-xs py-2 px-3">{value ? String(value) : '-'}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center py-4 text-muted-foreground text-xs">
                                        该图暂无 EXIF 信息
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                 </div>
              </div>
            </Card>
          </div>

          {/* 右侧编辑 */}
          <div className="lg:col-span-5">
            <Card className="border-2 shadow-xl sticky top-24">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-xl">批量编辑属性</CardTitle>
                        <CardDescription>配置将应用到选中或所有图片</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    
                    {/* 批量开关 */}
                    <FormField
                      control={form.control}
                      name="applyToAll"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 bg-primary/5 border-primary/20">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="font-bold text-primary">
                              应用设置到当前列表中所有图片
                            </FormLabel>
                            <p className="text-xs text-muted-foreground">
                              开启后，保存时将一次性同步修改所有已上传的图片
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    {/* GPS Section */}
                    <div className={`space-y-3 p-3 rounded-lg border transition-colors ${form.watch('modifyGPS') ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-muted-foreground/20'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-md text-primary">
                          <MapPin className="h-4 w-4" />
                          GPS 位置设置
                        </div>
                        <FormField
                          control={form.control}
                          name="modifyGPS"
                          render={({ field }) => (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">修改此项</span>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </div>
                          )}
                        />
                      </div>
                      
                      <div className={`grid grid-cols-2 gap-3 transition-opacity ${form.watch('modifyGPS') ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <FormField
                          control={form.control}
                          name="latitude"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">纬度 (-90 ~ 90)</FormLabel>
                              <FormControl>
                                <Input className="h-9" placeholder="39.9042" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage className="text-[10px]" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="longitude"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">经度 (-180 ~ 180)</FormLabel>
                              <FormControl>
                                <Input className="h-9" placeholder="116.4074" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage className="text-[10px]" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Device Section */}
                    <div className={`space-y-3 p-3 rounded-lg border transition-colors ${form.watch('modifyDevice') ? 'bg-purple-500/5 border-purple-500/20' : 'bg-muted/30 border-muted-foreground/20'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-md text-purple-500">
                          <Smartphone className="h-4 w-4" />
                          设备信息
                        </div>
                        <FormField
                          control={form.control}
                          name="modifyDevice"
                          render={({ field }) => (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">修改此项</span>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </div>
                          )}
                        />
                      </div>
                      
                      <div className={`grid grid-cols-2 gap-3 transition-opacity ${form.watch('modifyDevice') ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <FormField
                          control={form.control}
                          name="make"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">制造厂商</FormLabel>
                              <FormControl>
                                <Input className="h-9" placeholder="Apple" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="model"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">设备型号</FormLabel>
                              <FormControl>
                                <Input className="h-9" placeholder="iPhone 15" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Date Time Section */}
                    <div className={`space-y-3 p-3 rounded-lg border transition-colors ${form.watch('modifyDateTime') ? 'bg-amber-500/5 border-amber-500/20' : 'bg-muted/30 border-muted-foreground/20'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-md text-amber-500">
                          <Calendar className="h-4 w-4" />
                          拍摄时间
                        </div>
                        <FormField
                          control={form.control}
                          name="modifyDateTime"
                          render={({ field }) => (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">修改此项</span>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </div>
                          )}
                        />
                      </div>

                      <div className={`space-y-3 transition-opacity ${form.watch('modifyDateTime') ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <FormField
                          control={form.control}
                          name="dateOnly"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">日期</FormLabel>
                              <FormControl>
                                <Input type="date" className="h-9" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name="hourOnly"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">小时</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="小时" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {Array.from({ length: 24 }).map((_, i) => {
                                      const val = i.toString().padStart(2, '0');
                                      return <SelectItem key={val} value={val}>{val} 时</SelectItem>;
                                    })}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="minuteOnly"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">分钟</FormLabel>
                                <FormControl>
                                  <Input 
                                    className="h-9" 
                                    placeholder="随机" 
                                    {...field} 
                                    value={field.value || ''}
                                  />
                                </FormControl>
                                <FormDescription className="text-[10px]">留空则随机 (00-59)</FormDescription>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button type="submit" className="flex-1" size="lg">
                            <Check className="w-4 h-4 mr-2" /> 保存并应用修改
                        </Button>
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="lg" 
                            className="px-4"
                            onClick={() => downloadSingleImage(currentImageIndex)}
                        >
                            <Download className="h-5 w-5" />
                        </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="bg-muted/50 border-t p-4 rounded-b-xl flex flex-col gap-4 items-start">
                {/* 红色提示 - 仅在安卓手机端显示 */}
                {isAndroidMobile && (
                  <div className="flex gap-2 w-full">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-red-600 dark:text-red-400">
                        提示：夸克、UC 等手机浏览器具有更强的元数据读取能力。若默认相册无法读取 GPS，请尝试使用“文件管理”方式选取。
                      </p>
                  </div>
                )}
                
                {isAndroidMobile && <Separator />}
                
                <div className="space-y-2">
                    <h4 className="text-xs font-bold flex items-center gap-1 text-foreground">
                        <Info className="w-3 h-3 text-primary" /> 操作技巧与逻辑
                    </h4>
                    <ul className="text-[10px] text-muted-foreground list-disc pl-4 space-y-1">
                        <li><strong>选择性修改：</strong>勾选每个版块右上角的“修改此项”后，该版块的设置才会生效。</li>
                        <li><strong>时间修改规则：</strong>若只修改了日期未填分钟，系统将默认设为 08:XX（XX为随机分钟）。</li>
                        <li><strong>无时间信息处理：</strong>若图片原始不含拍摄时间，批量修改时将跳过该图片以保护原始状态。</li>
                        <li><strong>批量处理：</strong>开启“应用设置到所有图片”后，保存操作会同步更新列表中所有图片。</li>
                    </ul>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
      
      {/* 隐藏的上传输入框 */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/jpeg,image/jpg" 
        multiple
        className="hidden" 
      />
    </div>
  );
};

export default Home;
