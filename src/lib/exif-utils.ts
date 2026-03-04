import * as piexif from 'piexifjs';

export interface ExifData {
  original: any;
  formatted: Record<string, any>;
  gps: {
    latitude: number | null;
    longitude: number | null;
    altitude: number | null;
  };
}

// 转换十进制经纬度到 EXIF DMS 格式
export const decimalToDMS = (decimal: number): number[][] => {
  const absDecimal = Math.abs(decimal);
  const degrees = Math.floor(absDecimal);
  const minutes = Math.floor((absDecimal - degrees) * 60);
  const seconds = Math.round((absDecimal - degrees - (minutes / 60)) * 3600 * 100);
  return [[degrees, 1], [minutes, 1], [seconds, 100]];
};

// 转换 EXIF DMS 格式到十进制
export const dmsToDecimal = (dms: any[], ref: string): number | null => {
  if (!dms || dms.length < 3) return null;
  
  try {
    const degrees = dms[0][0] / dms[0][1];
    const minutes = dms[1][0] / dms[1][1];
    const seconds = dms[2][0] / dms[2][1];
    
    let decimal = degrees + (minutes / 60) + (seconds / 3600);
    if (ref === 'S' || ref === 'W') {
      decimal *= -1;
    }
    return Number(decimal.toFixed(6));
  } catch (e) {
    return null;
  }
};

export const getExifFromBase64 = (base64: string): ExifData => {
  const exifObj = piexif.load(base64);
  const formatted: Record<string, any> = {};
  
  // 提取 GPS 信息
  const gps = {
    latitude: exifObj["GPS"]?.[piexif.GPSIFD.GPSLatitude] ? dmsToDecimal(exifObj["GPS"][piexif.GPSIFD.GPSLatitude], exifObj["GPS"][piexif.GPSIFD.GPSLatitudeRef]) : null,
    longitude: exifObj["GPS"]?.[piexif.GPSIFD.GPSLongitude] ? dmsToDecimal(exifObj["GPS"][piexif.GPSIFD.GPSLongitude], exifObj["GPS"][piexif.GPSIFD.GPSLongitudeRef]) : null,
    altitude: exifObj["GPS"]?.[piexif.GPSIFD.GPSAltitude] ? exifObj["GPS"][piexif.GPSIFD.GPSAltitude][0] / exifObj["GPS"][piexif.GPSIFD.GPSAltitude][1] : null,
  };

  // 0th IFD
  if (exifObj["0th"]) {
    if (exifObj["0th"][piexif.ImageIFD.Make]) formatted["设备厂家"] = exifObj["0th"][piexif.ImageIFD.Make];
    if (exifObj["0th"][piexif.ImageIFD.Model]) formatted["设备型号"] = exifObj["0th"][piexif.ImageIFD.Model];
    if (exifObj["0th"][piexif.ImageIFD.Software]) formatted["软件版本"] = exifObj["0th"][piexif.ImageIFD.Software];
    if (exifObj["0th"][piexif.ImageIFD.XResolution]) formatted["水平分辨率"] = `${exifObj["0th"][piexif.ImageIFD.XResolution][0]}/${exifObj["0th"][piexif.ImageIFD.XResolution][1]}`;
  }
  
  // Exif IFD
  if (exifObj["Exif"]) {
    if (exifObj["Exif"][piexif.ExifIFD.DateTimeOriginal]) formatted["拍摄时间"] = exifObj["Exif"][piexif.ExifIFD.DateTimeOriginal];
    if (exifObj["Exif"][piexif.ExifIFD.ExposureTime]) formatted["曝光时间"] = `${exifObj["Exif"][piexif.ExifIFD.ExposureTime][0]}/${exifObj["Exif"][piexif.ExifIFD.ExposureTime][1]}s`;
    if (exifObj["Exif"][piexif.ExifIFD.FNumber]) formatted["光圈值"] = `f/${exifObj["Exif"][piexif.ExifIFD.FNumber][0] / exifObj["Exif"][piexif.ExifIFD.FNumber][1]}`;
    if (exifObj["Exif"][piexif.ExifIFD.ISOSpeedRatings]) formatted["ISO感光度"] = exifObj["Exif"][piexif.ExifIFD.ISOSpeedRatings];
    if (exifObj["Exif"][piexif.ExifIFD.FocalLength]) formatted["焦距"] = `${exifObj["Exif"][piexif.ExifIFD.FocalLength][0] / exifObj["Exif"][piexif.ExifIFD.FocalLength][1]}mm`;
  }

  return {
    original: exifObj,
    formatted,
    gps
  };
};

export const updateExifGps = (base64: string, lat: number | null, lng: number | null): string => {
  const exifObj = piexif.load(base64);
  
  // 确保 GPS IFD 存在
  if (!exifObj["GPS"]) exifObj["GPS"] = {};

  if (lat !== null && lng !== null) {
    const latRef = lat >= 0 ? "N" : "S";
    const lngRef = lng >= 0 ? "E" : "W";
    
    exifObj["GPS"][piexif.GPSIFD.GPSVersionID] = [2, 2, 0, 0];
    exifObj["GPS"][piexif.GPSIFD.GPSLatitudeRef] = latRef;
    exifObj["GPS"][piexif.GPSIFD.GPSLatitude] = decimalToDMS(lat);
    exifObj["GPS"][piexif.GPSIFD.GPSLongitudeRef] = lngRef;
    exifObj["GPS"][piexif.GPSIFD.GPSLongitude] = decimalToDMS(lng);
    
    if (!exifObj["GPS"][piexif.GPSIFD.GPSAltitude]) {
        exifObj["GPS"][piexif.GPSIFD.GPSAltitude] = [0, 1];
        exifObj["GPS"][piexif.GPSIFD.GPSAltitudeRef] = 0;
    }
  } else {
    exifObj["GPS"] = {};
  }

  const exifBytes = piexif.dump(exifObj);
  return piexif.insert(exifBytes, base64);
};

export const updateExifFields = (base64: string, updates: Record<string, string | null>): string => {
  const exifObj = piexif.load(base64);
  
  // 拍摄时间修改逻辑
  if (updates.dateTime) {
    if (!exifObj["Exif"]) exifObj["Exif"] = {};
    exifObj["Exif"][piexif.ExifIFD.DateTimeOriginal] = updates.dateTime;
    exifObj["Exif"][piexif.ExifIFD.DateTimeDigitized] = updates.dateTime;
  }
  
  // 设备厂家修改
  if (updates.make !== undefined) {
    if (!exifObj["0th"]) exifObj["0th"] = {};
    exifObj["0th"][piexif.ImageIFD.Make] = updates.make || "";
  }
  
  // 设备型号修改
  if (updates.model !== undefined) {
    if (!exifObj["0th"]) exifObj["0th"] = {};
    exifObj["0th"][piexif.ImageIFD.Model] = updates.model || "";
  }

  const exifBytes = piexif.dump(exifObj);
  return piexif.insert(exifBytes, base64);
};

// 格式化 EXIF 时间 (YYYY:MM:DD HH:MM:SS)
export const formatExifDate = (date: string, hour: string, minute: string): string => {
  // 确保日期格式正确，EXIF 使用冒号分隔日期
  const formattedDate = date.replace(/-/g, ':');
  return `${formattedDate} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
};

// 获取随机分钟 (00-59)
export const getRandomMinute = (): string => {
  return Math.floor(Math.random() * 60).toString().padStart(2, '0');
};
