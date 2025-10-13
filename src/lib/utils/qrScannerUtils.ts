/**
 * 跨平台二维码扫描工具
 * 支持 Capacitor (iOS/Android)、Web API 和文件上传
 */

import { Capacitor } from '@capacitor/core'

export interface QRScanResult {
    success: boolean
    data?: string
    error?: string
}

/**
 * 检查平台是否支持原生扫描
 */
export async function isScannerAvailable(): Promise<{
    native: boolean
    webAPI: boolean
    fileUpload: boolean
}> {
    const isNative = Capacitor.isNativePlatform()
    
    // 检查 Web API 支持
    let webAPISupported = false
    if ('BarcodeDetector' in window) {
        try {
            const formats = await (window as { BarcodeDetector?: { getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector?.getSupportedFormats?.()
            webAPISupported = formats ? formats.includes('qr_code') : false
        } catch {
            webAPISupported = false
        }
    }

    return {
        native: isNative,
        webAPI: webAPISupported,
        fileUpload: true // 文件上传总是可用
    }
}

/**
 * 使用原生扫描器（Capacitor）
 */
async function scanWithNative(): Promise<QRScanResult> {
    try {
        const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning')
        
        // 请求权限
        const { camera } = await BarcodeScanner.requestPermissions()
        if (camera !== 'granted') {
            return {
                success: false,
                error: '需要相机权限才能扫描二维码'
            }
        }

        // 开始扫描 - ML Kit 需要明确指定格式
        const { barcodes } = await BarcodeScanner.scan({
            formats: [
                BarcodeFormat.QrCode,
                BarcodeFormat.DataMatrix,
                BarcodeFormat.Aztec,
                BarcodeFormat.Pdf417
            ] // 支持多种二维码格式
        })

        if (barcodes && barcodes.length > 0) {
            return {
                success: true,
                data: barcodes[0].rawValue
            }
        }

        return {
            success: false,
            error: '未检测到二维码'
        }
    } catch (error) {
        console.error('Native scan error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : '扫描失败'
        }
    }
}

/**
 * 使用 Web Barcode Detection API
 * Chrome 桌面端的原生 API，识别率极高
 */
async function scanWithWebAPI(imageFile: File): Promise<QRScanResult> {
    try {
        const BarcodeDetectorClass = (window as { BarcodeDetector?: new (options?: { formats?: string[] }) => {
            detect: (image: ImageBitmap) => Promise<Array<{ rawValue: string }>>
        } }).BarcodeDetector
        
        if (!BarcodeDetectorClass) {
            return {
                success: false,
                error: '浏览器不支持 Barcode Detection API'
            }
        }

        const barcodeDetector = new BarcodeDetectorClass({
            formats: ['qr_code']
        })

        // 直接检测原图（通常就够了）
        const imageBitmap = await createImageBitmap(imageFile)
        const barcodes = await barcodeDetector.detect(imageBitmap)

        if (barcodes && barcodes.length > 0) {
            return {
                success: true,
                data: barcodes[0].rawValue
            }
        }

        return {
            success: false,
            error: '图片中未检测到二维码'
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : '扫描失败'
        }
    }
}

/**
 * 图像预处理：提高二维码识别率
 * 处理真实拍摄的照片（有背景、光照不均、倾斜等问题）
 */
async function preprocessImage(imageFile: File): Promise<HTMLCanvasElement[]> {
    const img = await createImageBitmap(imageFile)
    const canvases: HTMLCanvasElement[] = []
    
    // 1. 原图（高分辨率）
    const originalCanvas = document.createElement('canvas')
    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true })
    if (originalCtx) {
        originalCanvas.width = img.width
        originalCanvas.height = img.height
        originalCtx.drawImage(img, 0, 0)
        canvases.push(originalCanvas)
    }
    
    // 2. 缩放到合适尺寸（1200-1600px 之间最佳）
    const maxDim = Math.max(img.width, img.height)
    if (maxDim > 1600) {
        const scale = 1600 / maxDim
        const scaledCanvas = document.createElement('canvas')
        const scaledCtx = scaledCanvas.getContext('2d', { willReadFrequently: true })
        if (scaledCtx) {
            scaledCanvas.width = img.width * scale
            scaledCanvas.height = img.height * scale
            scaledCtx.imageSmoothingEnabled = true
            scaledCtx.imageSmoothingQuality = 'high'
            scaledCtx.drawImage(img, 0, 0, scaledCanvas.width, scaledCanvas.height)
            canvases.push(scaledCanvas)
        }
    }
    
    // 3. 增强对比度（帮助识别光照不均的图片）
    const contrastCanvas = document.createElement('canvas')
    const contrastCtx = contrastCanvas.getContext('2d', { willReadFrequently: true })
    if (contrastCtx) {
        const targetSize = maxDim > 1600 ? 1600 / maxDim : 1
        contrastCanvas.width = img.width * targetSize
        contrastCanvas.height = img.height * targetSize
        contrastCtx.imageSmoothingEnabled = true
        contrastCtx.imageSmoothingQuality = 'high'
        contrastCtx.drawImage(img, 0, 0, contrastCanvas.width, contrastCanvas.height)
        
        // 增强对比度
        const imageData = contrastCtx.getImageData(0, 0, contrastCanvas.width, contrastCanvas.height)
        const data = imageData.data
        const factor = 1.3 // 对比度增强因子
        const intercept = 128 * (1 - factor)
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.max(0, Math.min(255, data[i] * factor + intercept)) // R
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * factor + intercept)) // G
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * factor + intercept)) // B
        }
        
        contrastCtx.putImageData(imageData, 0, 0)
        canvases.push(contrastCanvas)
    }
    
    return canvases
}

/**
 * 使用 ZXing 扫描二维码（推荐方案）
 * Google 开发的业界标准库，移动端和桌面端识别率都很高
 * 支持多种图像预处理策略，提高真实照片的识别率
 */
async function scanWithZXing(imageFile: File): Promise<QRScanResult> {
    try {
        // 动态导入 ZXing
        const [
            { BrowserQRCodeReader }, 
            { BinaryBitmap, HybridBinarizer, QRCodeReader },
            { HTMLCanvasElementLuminanceSource }
        ] = await Promise.all([
            import('@zxing/browser'),
            import('@zxing/library'),
            import('@zxing/browser')
        ])
        
        const browserReader = new BrowserQRCodeReader()
        const coreReader = new QRCodeReader()
        
        // 获取多个预处理版本的图像
        const canvases = await preprocessImage(imageFile)
        
        // 依次尝试每个预处理版本
        for (const canvas of canvases) {
            try {
                // 方法1: 使用核心 API 直接从 canvas 解码（更快，支持更多配置）
                const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas)
                const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource))
                const result = coreReader.decode(binaryBitmap)
                
                return {
                    success: true,
                    data: result.getText()
                }
            } catch (_error) {
                // 方法1失败，尝试方法2：使用浏览器 Reader + 图像元素
                try {
                    const blob = await new Promise<Blob | null>((resolve) => {
                        canvas.toBlob(resolve, 'image/png')
                    })
                    
                    if (!blob) continue
                    
                    const imageUrl = URL.createObjectURL(blob)
                    const img = new Image()
                    
                    await new Promise((resolve, reject) => {
                        img.onload = resolve
                        img.onerror = reject
                        img.src = imageUrl
                    })
                    
                    try {
                        const result = await browserReader.decodeFromImageElement(img)
                        URL.revokeObjectURL(imageUrl)
                        return {
                            success: true,
                            data: result.getText()
                        }
                    } catch (_error2) {
                        URL.revokeObjectURL(imageUrl)
                        continue
                    }
                } catch (_error2) {
                    continue
                }
            }
        }
        
        // 所有版本都失败
        return {
            success: false,
            error: '图片中未检测到二维码'
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : '扫描失败'
        }
    }
}

/**
 * 使用 jsQR 扫描二维码（备用方案）
 * 识别率较低，但作为最后的备选
 */
async function scanWithJsQR(imageFile: File): Promise<QRScanResult> {
    try {
        const jsQR = (await import('jsqr')).default
        const imageBitmap = await createImageBitmap(imageFile)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        
        if (!ctx) {
            return {
                success: false,
                error: '无法创建 Canvas 上下文'
            }
        }

        // 桌面端：尝试 1200px 分辨率
        const maxDimension = Math.max(imageBitmap.width, imageBitmap.height)
        const targetSize = maxDimension > 1200 ? 1200 : maxDimension
        const scale = targetSize / maxDimension
        const width = Math.floor(imageBitmap.width * scale)
        const height = Math.floor(imageBitmap.height * scale)
        
        canvas.width = width
        canvas.height = height
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(imageBitmap, 0, 0, width, height)
        
        const imageData = ctx.getImageData(0, 0, width, height)
        const code = jsQR(imageData.data, width, height, {
            inversionAttempts: 'attemptBoth'
        })

        if (code) {
            return { success: true, data: code.data }
        }

        return {
            success: false,
            error: '未检测到二维码'
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : '扫描失败'
        }
    }
}



/**
 * 扫描图片文件中的二维码
 * 
 * 策略：
 * 1. Web Barcode Detection API（Chrome 桌面 - 最快最准）
 * 2. ZXing（推荐 - 移动端和桌面端识别率都很高）
 * 3. jsQR（备用 - 识别率较低）
 */
export async function scanImageFile(file: File): Promise<QRScanResult> {
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
        return {
            success: false,
            error: '请选择图片文件'
        }
    }

    // 策略 1: 优先使用 Web Barcode Detection API（桌面 Chrome）
    const { webAPI } = await isScannerAvailable()
    if (webAPI) {
        const result = await scanWithWebAPI(file)
        if (result.success) {
            return result
        }
    }

    // 策略 2: ZXing（移动端和桌面端都表现优秀）
    const zxingResult = await scanWithZXing(file)
    if (zxingResult.success) {
        return zxingResult
    }

    // 策略 3: jsQR 后备（作为最后的尝试）
    return await scanWithJsQR(file)
}

/**
 * Web 端实时相机扫描
 * 使用 getUserMedia + ZXing 实现高识别率的实时扫描
 */
export async function scanWithWebCamera(
    videoElement: HTMLVideoElement,
    onDetected: (data: string) => void,
    onError?: (error: string) => void
): Promise<() => void> {
    let stream: MediaStream | null = null

    try {
        // 请求相机权限
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment', // 后置摄像头
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        })

        videoElement.srcObject = stream
        await videoElement.play()

        // 使用 ZXing 的实时扫描
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        const reader = new BrowserQRCodeReader()

        // ZXing 提供了持续扫描的方法
        const controls = await reader.decodeFromVideoElement(
            videoElement,
            (result, error) => {
                if (result) {
                    onDetected(result.getText())
                    controls.stop()
                }
                // 忽略常规的 NotFoundException，只在真正出错时处理
                if (error && error.name !== 'NotFoundException') {
                    console.warn('ZXing scan error:', error)
                }
            }
        )

        // 返回清理函数
        return () => {
            controls.stop()
            if (stream) {
                stream.getTracks().forEach(track => track.stop())
            }
            videoElement.srcObject = null
        }
    } catch (error) {
        console.error('Web camera scan error:', error)
        if (onError) {
            onError(error instanceof Error ? error.message : '相机启动失败')
        }
        
        // 返回空清理函数
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop())
            }
        }
    }
}

/**
 * 主扫描函数 - 根据平台自动选择最佳方案
 */
export async function scanQRCode(): Promise<QRScanResult> {
    const availability = await isScannerAvailable()

    // 优先使用原生扫描
    if (availability.native) {
        return await scanWithNative()
    }

    // Web 平台需要用户选择图片
    return {
        success: false,
        error: 'web_file_required' // 特殊错误码，表示需要文件选择
    }
}

/**
 * 启动相机扫描（仅原生平台）
 */
export async function startCameraScan(): Promise<QRScanResult> {
    if (!Capacitor.isNativePlatform()) {
        return {
            success: false,
            error: '相机扫描仅在移动端可用'
        }
    }

    return await scanWithNative()
}
