// 上传页面 - 使用自建后端 API
const { BASE_URL } = require('../utils/config');

Page({
  data: {
    uploadType: 'camera', // camera | album
    selectedPhotos: [],
    isUploading: false,
    uploadProgress: 0,
    currentIndex: 0,
    isAnalyzing: false,
    analyzeProgress: 0,
    uploadComplete: false,
    uploadedIds: []
  },

  onLoad(options) {
    const type = options.type || 'camera';
    this.setData({ uploadType: type });
    
    // 自动触发对应类型的选图
    if (type === 'camera') {
      this.takePhoto();
    } else {
      this.chooseFromAlbum();
    }
  },

  // 拍照
  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.processImage(tempFilePath);
      },
      fail: (err) => {
        console.log('拍照取消', err);
        wx.navigateBack();
      }
    });
  },

  // 从相册选择
  chooseFromAlbum() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        const photos = res.tempFiles.map(item => item.tempFilePath);
        this.setData({ selectedPhotos: photos });
        this.startUpload();
      },
      fail: (err) => {
        console.log('选择取消', err);
        wx.navigateBack();
      }
    });
  },

  // 处理拍照返回的图片
  processImage(filePath) {
    this.setData({ selectedPhotos: [filePath] });
    this.startUpload();
  },

  // 开始上传
  startUpload() {
    const { selectedPhotos } = this.data;
    if (selectedPhotos.length === 0) return;

    this.setData({ 
      isUploading: true, 
      uploadProgress: 0,
      currentIndex: 0,
      uploadedIds: []
    });

    this.uploadNext();
  },

  // 上传下一张
  uploadNext() {
    const { selectedPhotos, currentIndex, uploadedIds } = this.data;
    
    if (currentIndex >= selectedPhotos.length) {
      // 上传完成
      this.setData({ 
        isUploading: false, 
        uploadComplete: true 
      });
      wx.showToast({ title: '上传成功', icon: 'success' });
      return;
    }

    const filePath = selectedPhotos[currentIndex];
    this.uploadSinglePhoto(filePath, currentIndex);
  },

  // 上传单张照片到自建后端
  uploadSinglePhoto(filePath, index) {
    const that = this;
    
    wx.uploadFile({
      url: `${BASE_URL}/api/photo/upload`,
      filePath: filePath,
      name: 'file',
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.success) {
            const { uploadedIds } = that.data;
            uploadedIds.push(data.photo_id);
            that.setData({ 
              uploadedIds,
              currentIndex: that.data.currentIndex + 1,
              uploadProgress: Math.round((that.data.currentIndex + 1) / that.data.selectedPhotos.length * 100)
            });
            
            // 上传下一张
            that.uploadNext();
          } else {
            wx.showToast({ title: '上传失败', icon: 'error' });
          }
        } catch (e) {
          console.error('解析响应失败', e);
          wx.showToast({ title: '上传失败', icon: 'error' });
        }
      },
      fail: (err) => {
        console.error('上传失败', err);
        wx.showToast({ title: '上传失败', icon: 'error' });
      }
    });
  },

  // 查看全部照片
  viewAllPhotos() {
    wx.switchTab({ url: '/pages/album/index' });
  },

  // 继续上传
  continueUpload() {
    this.setData({ 
      uploadComplete: false,
      selectedPhotos: [],
      uploadedIds: []
    });
    this.chooseFromAlbum();
  },

  // 返回首页
  goHome() {
    wx.switchTab({ url: '/pages/album/index' });
  }
});
