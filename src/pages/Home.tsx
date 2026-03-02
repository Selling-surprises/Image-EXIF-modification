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
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { getExifFromBase64, updateExifGps, updateExifFields, type ExifData } from '@/lib/exif-utils';

// 表单验证模式
const exifFormSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  dateTime: z.string().optional(),
});

type ExifFormValues = z.infer<typeof exifFormSchema>;

const Home: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const [isModified, setIsModified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ExifFormValues>({
    resolver: zodResolver(exifFormSchema),
    defaultValues: {
      latitude: null,
      longitude: null,
      make: '',
      model: '',
      dateTime: '',
    },
  });

  // 处理图片上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/jpeg')) {
        toast.error('目前仅支持 JPEG/JPG 格式图片的 EXIF 修改');
        return;
      }
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setBase64Image(base64);
      setImageFile(file);
      setIsModified(false);
      
      try {
        const data = getExifFromBase64(base64);
        setExifData(data);
        
        // 更新表单默认值
        form.reset({
          latitude: data.gps.latitude,
          longitude: data.gps.longitude,
          make: data.formatted["设备厂家"] || '',
          model: data.formatted["设备型号"] || '',
          dateTime: data.formatted["拍摄时间"] || '',
        });
        
        toast.success('图片解析成功');
      } catch (error) {
        console.error('EXIF Parsing Error:', error);
        toast.error('无法解析图片 EXIF 信息，可能是该图片不含元数据');
        setExifData(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // 拖拽处理
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
        if (!file.type.startsWith('image/jpeg')) {
            toast.error('目前仅支持 JPEG/JPG 格式图片的 EXIF 修改');
            return;
        }
        processFile(file);
    }
  };

  // 提交修改
  const onSubmit = (values: ExifFormValues) => {
    if (!base64Image) return;

    try {
      let updatedBase64 = base64Image;
      
      // 更新 GPS
      updatedBase64 = updateExifGps(updatedBase64, values.latitude ?? null, values.longitude ?? null);
      
      // 更新其他字段
      const fieldUpdates: Record<string, string> = {};
      if (values.make) fieldUpdates.make = values.make;
      if (values.model) fieldUpdates.model = values.model;
      if (values.dateTime) fieldUpdates.dateTime = values.dateTime;
      
      updatedBase64 = updateExifFields(updatedBase64, fieldUpdates);
      
      setBase64Image(updatedBase64);
      setIsModified(true);
      
      // 重新读取以更新 UI
      const newData = getExifFromBase64(updatedBase64);
      setExifData(newData);
      
      toast.success('EXIF 信息已保存到临时缓冲区');
    } catch (error) {
      console.error('Update Error:', error);
      toast.error('修改 EXIF 信息失败');
    }
  };

  // 下载图片
  const downloadImage = () => {
    if (!base64Image || !imageFile) return;
    
    const link = document.createElement('a');
    link.href = base64Image;
    link.download = `modified_${imageFile.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('图片已开始下载');
  };

  const removeImage = () => {
    setImageFile(null);
    setBase64Image(null);
    setExifData(null);
    setIsModified(false);
    form.reset();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col items-center justify-center space-y-4 text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          图片 <span className="text-primary font-black">EXIF</span> 编辑器
        </h1>
        <p className="text-xl text-muted-foreground max-w-[700px]">
          查看、编辑和修复您的照片元数据。保护您的位置隐私或记录重要的拍摄信息。
        </p>
      </div>

      {!base64Image ? (
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
          <p className="text-muted-foreground">支持 JPG, JPEG 格式 (文件大小上限 10MB)</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/jpeg,image/jpg" 
            className="hidden" 
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* 左侧预览 */}
          <div className="md:col-span-5 space-y-4">
            <Card className="overflow-hidden border-2 shadow-lg">
              <div className="aspect-square bg-muted relative flex items-center justify-center overflow-hidden">
                <img 
                  src={base64Image} 
                  alt="Preview" 
                  className="max-w-full max-h-full object-contain shadow-2xl" 
                />
                <Button 
                    variant="destructive" 
                    size="icon" 
                    className="absolute top-4 right-4 rounded-full shadow-lg"
                    onClick={removeImage}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <CardContent className="p-4 bg-muted/30">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-muted-foreground flex items-center gap-1">
                    <ImageIcon className="w-4 h-4" /> {imageFile?.name}
                  </span>
                  <Badge variant="outline">{(imageFile!.size / (1024 * 1024)).toFixed(2)} MB</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Info className="h-5 w-5 text-blue-500" />
                        元数据详情
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableBody>
                            {exifData ? Object.entries(exifData.formatted).map(([key, value]) => (
                                <TableRow key={key}>
                                    <TableCell className="font-medium text-muted-foreground py-2 px-4">{key}</TableCell>
                                    <TableCell className="text-right py-2 px-4">{value ? String(value) : '-'}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                                        暂无 EXIF 信息
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          </div>

          {/* 右侧编辑 */}
          <div className="md:col-span-7 space-y-6">
            <Card className="border-2 shadow-xl">
              <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-2xl">编辑 EXIF 信息</CardTitle>
                        <CardDescription>修改以下字段并保存以应用更改</CardDescription>
                    </div>
                    {isModified && (
                        <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20 flex gap-1">
                            <CheckCircle2 className="w-3 h-3" /> 已修改
                        </Badge>
                    )}
                </div>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* GPS Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 font-semibold text-lg text-primary">
                        <MapPin className="h-5 w-5" />
                        GPS 地理位置
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="latitude"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>纬度 (Latitude)</FormLabel>
                              <FormControl>
                                <Input placeholder="如: 39.9042" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormDescription>范围: -90 到 90</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="longitude"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>经度 (Longitude)</FormLabel>
                              <FormControl>
                                <Input placeholder="如: 116.4074" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormDescription>范围: -180 到 180</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Device & Time Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 font-semibold text-lg text-purple-500">
                        <Smartphone className="h-5 w-5" />
                        设备与拍摄时间
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="make"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>制造厂商</FormLabel>
                              <FormControl>
                                <Input placeholder="如: Apple" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="model"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>设备型号</FormLabel>
                              <FormControl>
                                <Input placeholder="如: iPhone 13" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="dateTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" /> 拍摄日期/时间 (EXIF 格式)
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="YYYY:MM:DD HH:MM:SS" {...field} />
                            </FormControl>
                            <FormDescription>请遵循格式 2024:01:01 12:00:00</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Button type="submit" className="flex-1" size="lg">
                            保存修改
                        </Button>
                        <Button 
                            type="button" 
                            variant="secondary" 
                            size="lg" 
                            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={downloadImage}
                            disabled={!base64Image}
                        >
                            <Download className="mr-2 h-5 w-5" /> 下载图片
                        </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="bg-muted/50 border-t p-4 rounded-b-xl flex gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  提示: 修改后的图片保存在浏览器内存中。下载后，所有 EXIF 标签将按照您的设置重新嵌入图片。JPG 以外的格式目前支持有限。
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
