// 上传页面
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
        const photos = res.tempFiles.map(item => ({
          path: item.tempFilePath,
          size: item.size,
          status: 'pending'
        }));
        this.setData({ 
          selectedPhotos: photos,
          uploadType: 'album'
        });
      },
      fail: (err) => {
        console.log('选择取消', err);
        wx.navigateBack();
      }
    });
  },

  // 处理图片（压缩）
  async processImage(filePath) {
    wx.showLoading({ title: '处理中...' });
    
    try {
      // 压缩图片
      const compressedPath = await this.compressImage(filePath);
      
      this.setData({
        selectedPhotos: [{
          path: compressedPath,
          size: 0,
          status: 'ready'
        }]
      });
      
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '图片处理失败', icon: 'none' });
      console.error(err);
    }
  },

  // 图片压缩
  compressImage(filePath) {
    return new Promise((resolve, reject) => {
      wx.compressImage({
        src: filePath,
        quality: 80,
        success: (res) => {
          resolve(res.tempFilePath);
        },
        fail: (err) => {
          // 压缩失败则使用原图
          resolve(filePath);
        }
      });
    });
  },

  // 开始上传
  async startUpload() {
    const { selectedPhotos } = this.data;
    if (selectedPhotos.length === 0) return;

    this.setData({ isUploading: true, uploadProgress: 0 });

    const uploadedIds = [];
    const total = selectedPhotos.length;

    for (let i = 0; i < total; i++) {
      this.setData({ currentIndex: i });
      
      try {
        const fileId = await this.uploadSinglePhoto(selectedPhotos[i].path, i);
        uploadedIds.push(fileId);
        
        this.setData({
          uploadProgress: Math.round(((i + 1) / total) * 100)
        });
      } catch (err) {
        console.error(`第${i + 1}张上传失败`, err);
        wx.showToast({ title: `第${i + 1}张上传失败`, icon: 'none' });
      }
    }

    this.setData({ 
      uploadedIds: uploadedIds,
      isUploading: false 
    });

    // 开始 AI 分析
    this.analyzePhotos();
  },

  // 上传单张照片到云存储
  uploadSinglePhoto(filePath, index) {
    return new Promise((resolve, reject) => {
      const cloudPath = `photos/${Date.now()}-${index}.jpg`;
      
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: (res) => {
          resolve(res.fileID);
        },
        fail: reject
      });
    });
  },

  // AI 分析照片
  async analyzePhotos() {
    this.setData({ isAnalyzing: true, analyzeProgress: 0 });
    
    const { uploadedIds } = this.data;
    const total = uploadedIds.length;
    const db = wx.cloud.database();

    for (let i = 0; i < total; i++) {
      try {
        // 调用云函数进行 AI 分析
        const result = await wx.cloud.callFunction({
          name: 'ai-analyze',
          data: { fileID: uploadedIds[i] }
        });

        // 保存到数据库
        await db.collection('photos').add({
          data: {
            fileID: uploadedIds[i],
            shotDate: new Date(),
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            aiResult: result.result || {},
            remark: '',
            isMilestone: false,
            _createTime: db.serverDate(),
            _updateTime: db.serverDate()
          }
        });

        this.setData({
          analyzeProgress: Math.round(((i + 1) / total) * 100)
        });
      } catch (err) {
        console.error(`第${i + 1}张AI分析失败`, err);
      }
    }

    this.setData({ 
      isAnalyzing: false,
      uploadComplete: true 
    });
  },

  // 重新选择
  reselect() {
    if (this.data.uploadType === 'camera') {
      this.takePhoto();
    } else {
      this.chooseFromAlbum();
    }
  },

  // 返回相册
  goToAlbum() {
    wx.switchTab({ url: '/pages/album/index' });
  },

  // 预览图片
  previewImage(e) {
    const { path } = e.currentTarget.dataset;
    wx.previewImage({
      current: path,
      urls: this.data.selectedPhotos.map(p => p.path)
    });
  }
});
