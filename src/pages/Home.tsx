import React, { useState, useRef } from 'react';
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

import { getExifFromBase64, updateExifGps, updateExifFields, type ExifData } from '@/lib/exif-utils';

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
  latitude: z.union([z.number(), z.null()]).optional(),
  longitude: z.union([z.number(), z.null()]).optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  dateTime: z.string().optional(),
  applyToAll: z.boolean(),
});

interface ExifFormValues {
  latitude?: number | null;
  longitude?: number | null;
  make?: string;
  model?: string;
  dateTime?: string;
  applyToAll: boolean;
}

const Home: React.FC = () => {
  const [images, setImages] = useState<ImageData[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ExifFormValues>({
    resolver: zodResolver(exifFormSchema),
    defaultValues: {
      latitude: null,
      longitude: null,
      make: '',
      model: '',
      dateTime: '',
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
              form.reset({
                latitude: data.gps.latitude,
                longitude: data.gps.longitude,
                make: data.formatted["设备厂家"] || '',
                model: data.formatted["设备型号"] || '',
                dateTime: data.formatted["拍摄时间"] || '',
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

      indicesToUpdate.forEach(index => {
        let updatedBase64 = updatedImages[index].base64;
        
        // 更新 GPS
        updatedBase64 = updateExifGps(updatedBase64, values.latitude ?? null, values.longitude ?? null);
        
        // 更新其他字段
        const fieldUpdates: Record<string, string> = {};
        if (values.make) fieldUpdates.make = values.make;
        if (values.model) fieldUpdates.model = values.model;
        if (values.dateTime) fieldUpdates.dateTime = values.dateTime;
        
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
      
      if (applyToAll) {
        toast.success(`已将修改应用到所有 ${images.length} 张图片`);
      } else {
        toast.success('EXIF 信息已保存');
      }
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
    link.download = `modified_${img.file.name}`;
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
        zip.file(`modified_${img.file.name}`, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `exif_edited_images_${Date.now()}.zip`;
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
      form.reset({
        latitude: img.exifData.gps.latitude,
        longitude: img.exifData.gps.longitude,
        make: img.exifData.formatted["设备厂家"] || '',
        model: img.exifData.formatted["设备型号"] || '',
        dateTime: img.exifData.formatted["拍摄时间"] || '',
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
          
          {/* 红色提示 */}
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-950/20 border-2 border-red-500 rounded-lg max-w-md">
            <p className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>推荐使用夸克、UC 等浏览器，可直接读取完整图片信息！</span>
            </p>
          </div>
          
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
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 font-semibold text-md text-primary">
                        <MapPin className="h-4 w-4" />
                        GPS 位置设置
                      </div>
                      <div className="grid grid-cols-2 gap-3">
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
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 font-semibold text-md text-purple-500">
                        <Smartphone className="h-4 w-4" />
                        设备信息
                      </div>
                      <div className="grid grid-cols-2 gap-3">
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

                    <FormField
                      control={form.control}
                      name="dateTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1 text-xs">
                              <Calendar className="w-3 h-3" /> 拍摄日期/时间
                          </FormLabel>
                          <FormControl>
                            <Input className="h-9" placeholder="YYYY:MM:DD HH:MM:SS" {...field} />
                          </FormControl>
                          <FormMessage className="text-[10px]" />
                        </FormItem>
                      )}
                    />

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
                <div className="flex gap-2 w-full">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-red-600 dark:text-red-400">
                      提示：夸克、UC 等手机浏览器具有更强的元数据读取能力。若默认相册无法读取 GPS，请尝试使用“文件管理”方式选取。
                    </p>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                    <h4 className="text-xs font-bold flex items-center gap-1 text-foreground">
                        <Info className="w-3 h-3 text-primary" /> 操作技巧
                    </h4>
                    <ul className="text-[10px] text-muted-foreground list-disc pl-4 space-y-1">
                        <li><strong>批量处理：</strong>开启“应用设置到所有图片”后，保存操作会同步更新列表中所有图片。</li>
                        <li><strong>批量导出：</strong>点击左侧列表底部的“批量下载 ZIP”可将所有处理后的图片打包下载。</li>
                        <li><strong>iOS 用户：</strong>选取照片时请点击“选项”并勾选“所有照片数据”。</li>
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
