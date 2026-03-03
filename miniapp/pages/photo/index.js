// 照片详情页
Page({
  data: {
    photoId: '',
    photo: null,
    isLoading: true,
    isEditing: false,
    remark: '',
    showDeleteConfirm: false
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.setData({ photoId: id });
      this.loadPhotoDetail(id);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      wx.navigateBack();
    }
  },

  // 加载照片详情
  loadPhotoDetail(id) {
    this.setData({ isLoading: true });
    const db = wx.cloud.database();
    
    db.collection('photos').doc(id).get().then(res => {
      const photo = res.data;
      this.setData({
        photo,
        remark: photo.remark || '',
        isLoading: false
      });
    }).catch(err => {
      console.error('加载失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ isLoading: false });
    });
  },

  // 预览大图
  previewImage() {
    const { photo } = this.data;
    wx.previewImage({
      current: photo.fileID,
      urls: [photo.fileID]
    });
  },

  // 编辑备注
  startEdit() {
    this.setData({ isEditing: true });
  },

  // 备注输入
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  // 保存备注
  saveRemark() {
    const { photoId, remark } = this.data;
    const db = wx.cloud.database();
    
    wx.showLoading({ title: '保存中...' });
    
    db.collection('photos').doc(photoId).update({
      data: {
        remark: remark,
        _updateTime: db.serverDate()
      }
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.setData({ isEditing: false, 'photo.remark': remark });
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  },

  // 取消编辑
  cancelEdit() {
    this.setData({ 
      isEditing: false,
      remark: this.data.photo.remark || ''
    });
  },

  // 标记里程碑
  toggleMilestone() {
    const { photoId, photo } = this.data;
    const db = wx.cloud.database();
    const newStatus = !photo.isMilestone;
    
    db.collection('photos').doc(photoId).update({
      data: {
        isMilestone: newStatus,
        _updateTime: db.serverDate()
      }
    }).then(() => {
      wx.showToast({ 
        title: newStatus ? '已标记里程碑' : '已取消标记', 
        icon: 'success' 
      });
      this.setData({ 'photo.isMilestone': newStatus });
    }).catch(err => {
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  // 显示删除确认
  showDeleteModal() {
    this.setData({ showDeleteConfirm: true });
  },

  // 隐藏删除确认
  hideDeleteModal() {
    this.setData({ showDeleteConfirm: false });
  },

  // 删除照片
  deletePhoto() {
    const { photoId, photo } = this.data;
    const db = wx.cloud.database();
    
    wx.showLoading({ title: '删除中...' });
    
    // 删除云存储文件
    wx.cloud.deleteFile({
      fileList: [photo.fileID],
      success: () => {
        // 删除数据库记录
        db.collection('photos').doc(photoId).remove().then(() => {
          wx.hideLoading();
          wx.showToast({ title: '删除成功', icon: 'success' });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }).catch(err => {
          wx.hideLoading();
          wx.showToast({ title: '删除失败', icon: 'none' });
        });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('删除文件失败', err);
        // 即使文件删除失败，仍尝试删除数据库记录
        db.collection('photos').doc(photoId).remove().then(() => {
          wx.navigateBack();
        });
      }
    });
  },

  // 复制 AI 描述
  copyDescription() {
    const { photo } = this.data;
    if (photo.aiResult && photo.aiResult.description) {
      wx.setClipboardData({
        data: photo.aiResult.description,
        success: () => {
          wx.showToast({ title: '已复制', icon: 'success' });
        }
      });
    }
  },

  // 格式化日期
  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

  // 标签颜色映射
  getTagColor(type) {
    const colors = {
      expression: '#FF6B9D',
      action: '#67D4CA',
      milestone: '#FFB347'
    };
    return colors[type] || '#999';
  }
});
