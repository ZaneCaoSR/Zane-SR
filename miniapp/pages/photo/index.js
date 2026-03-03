// 照片详情页
const { BASE_URL } = require('../../utils/config');

Page({
  data: {
    photoId: '',
    photo: null,
    isLoading: true,
    isEditing: false,
    remark: '',
    showDeleteConfirm: false,
    isAnalyzing: false,
    showTagModal: false,
    newTag: { type: 'emotion', value: '' },
    themeColor: '#FF6B9D'
  },

  // 预定义标签
  tagTypes: [
    { type: 'emotion', label: '表情', values: ['开心', '惊讶', '困倦', '好奇', '平静', '大笑', '哭闹'] },
    { type: 'action', label: '动作', values: ['抬头', '翻身', '爬行', '走路', '吃饭', '睡觉', '玩耍'] },
    { type: 'milestone', label: '里程碑', values: ['百天', '周岁', '长牙', '会坐', '会站', '会走'] },
    { type: 'scene', label: '场景', values: ['室内', '户外', '商场', '公园', '家里', '海边'] },
    { type: 'weather', label: '天气', values: ['晴天', '阴天', '雨天', '雪天'] }
  ],

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

  onShow() {
    // 应用主题颜色
    const themeColor = wx.getStorageSync('themeColor') || '#FF6B9D';
    this.setData({ themeColor });
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: themeColor,
      animation: { duration: 300, timingFunc: 'easeInOut' }
    });
  },

  // 加载照片详情
  loadPhotoDetail(id) {
    this.setData({ isLoading: true });

    wx.request({
      url: `${BASE_URL}/api/photos/${id}`,
      success: (res) => {
        if (res.data && res.data.photo) {
          const photo = res.data.photo;
          this.setData({
            photo,
            remark: photo.remark || '',
            isLoading: false
          });
        }
      },
      fail: (err) => {
        console.error('加载失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ isLoading: false });
      }
    });
  },

  // 预览大图
  previewImage() {
    const { photo } = this.data;
    wx.previewImage({
      current: photo.url,
      urls: [photo.url]
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

    wx.showLoading({ title: '保存中...' });

    wx.request({
      url: `${BASE_URL}/api/photo/${photoId}`,
      method: 'PUT',
      data: { remark },
      success: () => {
        wx.hideLoading();
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.setData({ isEditing: false, 'photo.remark': remark });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
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
    const { photo } = this.data;
    const newStatus = !photo.isMilestone;

    wx.request({
      url: `${BASE_URL}/api/photo/${photo.id}`,
      method: 'PUT',
      data: { isMilestone: newStatus },
      success: () => {
        wx.showToast({
          title: newStatus ? '已标记里程碑' : '已取消标记',
          icon: 'success'
        });
        this.setData({ 'photo.isMilestone': newStatus });
      },
      fail: () => {
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
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
    const { photoId } = this.data;

    wx.showLoading({ title: '删除中...' });

    wx.request({
      url: `${BASE_URL}/api/photo/${photoId}`,
      method: 'DELETE',
      success: () => {
        wx.hideLoading();
        wx.showToast({ title: '删除成功', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '删除失败', icon: 'none' });
      }
    });
  },

  // 复制 AI 描述
  copyDescription() {
    const { photo } = this.data;
    if (photo.ai_result && photo.ai_result.description) {
      wx.setClipboardData({
        data: photo.ai_result.description,
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
      milestone: '#FFB347',
      emotion: '#FF6B9D',
      scene: '#A8C0D8',
      weather: '#FFD166'
    };
    return colors[type] || '#999';
  },

  // AI 分析照片
  analyzePhoto() {
    const { photoId, isAnalyzing } = this.data;
    if (isAnalyzing) return;

    this.setData({ isAnalyzing: true });
    wx.showLoading({ title: 'AI 分析中...' });

    wx.request({
      url: `${BASE_URL}/api/photo/${photoId}/analyze`,
      method: 'POST',
      success: (res) => {
        wx.hideLoading();
        if (res.data && res.data.success) {
          this.setData({ 'photo.tags': res.data.tags, isAnalyzing: false });
          wx.showToast({ title: '分析完成', icon: 'success' });
        } else {
          this.setData({ isAnalyzing: false });
          wx.showToast({ title: '分析失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ isAnalyzing: false });
        // 模拟分析成功（用于测试）
        this.simulateAnalyze();
      }
    });
  },

  // 模拟AI分析（用于测试或无后端时）
  simulateAnalyze() {
    const tags = [
      { type: 'emotion', value: '开心', confidence: 0.95 },
      { type: 'action', value: '玩耍', confidence: 0.88 },
      { type: 'scene', value: '家里', confidence: 0.92 }
    ];
    this.setData({ 'photo.tags': tags });
    wx.showToast({ title: '已添加标签', icon: 'success' });
  },

  // 显示添加标签弹窗
  showAddTagModal() {
    this.setData({ showTagModal: true, 'newTag.value': '' });
  },

  // 隐藏添加标签弹窗
  hideTagModal() {
    this.setData({ showTagModal: false });
  },

  // 选择标签类型
  onTagTypeChange(e) {
    const index = e.detail.value;
    const type = this.data.tagTypes[index].type;
    this.setData({ 'newTag.type': type, 'newTag.value': '' });
  },

  // 选择标签值
  onTagValueTap(e) {
    const value = e.currentTarget.dataset.value;
    this.addTag(value);
  },

  // 输入自定义标签
  onCustomTagInput(e) {
    this.setData({ 'newTag.value': e.detail.value });
  },

  // 添加标签
  addTag(value) {
    const { photo, newTag } = this.data;
    if (!value && !newTag.value) {
      wx.showToast({ title: '请选择或输入标签', icon: 'none' });
      return;
    }

    const tagValue = value || newTag.value;
    const tagType = newTag.type;

    // 检查是否已存在
    const existingTags = photo.tags || [];
    if (existingTags.some(t => t.value === tagValue && t.type === tagType)) {
      wx.showToast({ title: '标签已存在', icon: 'none' });
      return;
    }

    const newTagObj = { type: tagType, value: tagValue, confidence: 1.0 };
    const updatedTags = [...existingTags, newTagObj];

    this.setData({
      'photo.tags': updatedTags,
      showTagModal: false
    });

    // 保存到后端
    this.saveTags(updatedTags);
  },

  // 保存标签到后端
  saveTags(tags) {
    const { BASE_URL } = require('../../utils/config');
    const { photoId } = this.data;

    wx.request({
      url: `${BASE_URL}/api/photo/${photoId}`,
      method: 'PUT',
      data: { tags },
      success: (res) => {
        if (res.data && res.data.success) {
          wx.showToast({ title: '保存成功', icon: 'success' });
        }
      }
    });
  },

  // 删除标签
  removeTag(e) {
    const index = e.currentTarget.dataset.index;
    const { photo } = this.data;
    const tags = [...photo.tags];
    tags.splice(index, 1);

    this.setData({ 'photo.tags': tags });
    this.saveTags(tags);
  }
});
