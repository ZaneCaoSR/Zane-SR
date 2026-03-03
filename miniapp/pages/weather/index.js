// 天气首页
const { BASE_URL } = require('../../utils/config');
const app = getApp();

Page({
  data: {
    city: '杭州',
    cities: [],  // 多城市列表 [{city, cityId, weatherData, loading, loaded}]
    currentCityIndex: 0,
    weather: {},
    updateTime: '',
    userCity: '杭州',
    loading: false
  },

  onLoad() {
    this.loadSubscribedCities();
  },

  onShow() {
    // 每次显示时刷新订阅状态
    this.loadSubscribedCities();

    const app = getApp();
    if (app.globalData.userCity) {
      // 切换到对应的城市索引
      const cities = this.data.cities;
      const index = cities.findIndex(c => c.city === app.globalData.userCity);
      if (index !== -1 && index !== this.data.currentCityIndex) {
        this.setData({ currentCityIndex: index });
        // 懒加载当前城市的天气
        this.loadWeatherIfNeeded(index);
      }
    }
  },

  // 加载已订阅的城市
  async loadSubscribedCities() {
    const openid = app.globalData.openid;
    if (!openid) {
      // 未登录，使用默认城市
      this.setData({
        cities: [{ city: '杭州', weatherData: {}, loading: false, loaded: false }],
        currentCityIndex: 0
      });
      this.loadWeatherForCity('杭州', 0);
      return;
    }

    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${BASE_URL}/api/subscribed-cities?openid=${openid}`,
          success: (res) => resolve(res.data),
          fail: reject
        });
      });

      let cities = [];
      if (res.subscribed && res.cities && res.cities.length > 0) {
        // 使用已订阅的城市
        cities = res.cities.map(c => ({
          city: c.city,
          cityId: c.cityId || null,
          pushTime: c.pushTime || '08:00',
          weatherData: {},
          loading: false,
          loaded: false
        }));
      } else {
        // 没有订阅，使用默认城市
        const defaultCity = app.globalData.userCity || '杭州';
        cities = [{ city: defaultCity, weatherData: {}, loading: false, loaded: false }];
      }

      this.setData({
        cities: cities,
        currentCityIndex: 0
      });

      // 只加载第一个城市的天气（懒加载）
      this.loadWeatherIfNeeded(0);

    } catch (err) {
      console.error('[Weather] 加载订阅城市失败:', err);
      // 使用默认城市
      const defaultCity = app.globalData.userCity || '杭州';
      this.setData({
        cities: [{ city: defaultCity, weatherData: {}, loading: false, loaded: false }],
        currentCityIndex: 0
      });
      this.loadWeatherForCity(defaultCity, 0);
    }
  },

  // 懒加载天气 - 仅当需要时加载
  loadWeatherIfNeeded(index) {
    const cities = this.data.cities;
    if (index >= 0 && index < cities.length && !cities[index].loaded && !cities[index].loading) {
      this.loadWeatherForCity(cities[index].city, index);
    }
  },

  // 加载单个城市的天气
  loadWeatherForCity(city, index = null) {
    const idx = index !== null ? index : this.data.currentCityIndex;
    const cities = this.data.cities;

    // 设置加载状态
    cities[idx].loading = true;
    this.setData({ cities: cities, loading: true });

    wx.request({
      url: `${BASE_URL}/api/weather/${encodeURIComponent(city)}`,
      success: (res) => {
        if (res.data && res.data.city) {
          // 更新对应城市的天气数据
          cities[idx].weatherData = res.data;
          cities[idx].loaded = true;
          cities[idx].loading = false;
          this.setData({ cities: cities });

          // 更新时间
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          this.setData({ updateTime: timeStr, loading: false });
        }
      },
      fail: (err) => {
        console.error(`[Weather] 获取 ${city} 天气失败:`, err);
        cities[idx].loading = false;
        this.setData({ cities: cities, loading: false });
      }
    });
  },

  // Swiper 切换事件
  onSwiperChange(e) {
    const index = e.detail.current;
    this.setData({ currentCityIndex: index });

    // 更新全局当前城市
    const city = this.data.cities[index].city;
    app.globalData.userCity = city;

    // 懒加载当前城市的天气
    this.loadWeatherIfNeeded(index);
  },

  // 城市选择
  onCitySelect() {
    wx.navigateTo({
      url: '/pages/city-select/city-select'
    });
  },

  // 订阅天气
  onSubscribe() {
    const openid = app.globalData.openid;
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.switchTab({ url: '/pages/my/index' });
      return;
    }

    const currentCity = this.data.cities[this.data.currentCityIndex];

    wx.request({
      url: `${BASE_URL}/api/subscribe-multiple`,
      method: 'POST',
      data: {
        openid: openid,
        cities: [{
          city: currentCity.city,
          pushTime: '08:00',
          isActive: true
        }]
      },
      success: (res) => {
        if (res.data.success) {
          wx.showToast({ title: '订阅成功', icon: 'success' });
          // 刷新订阅列表
          this.loadSubscribedCities();
        } else {
          wx.showToast({ title: res.data.message || '订阅失败', icon: 'error' });
        }
      },
      fail: () => {
        wx.showToast({ title: '订阅失败', icon: 'error' });
      }
    });
  },

  // 下拉刷新 - 只刷新当前城市
  onPullDownRefresh() {
    const index = this.data.currentCityIndex;
    const cities = this.data.cities;
    // 重置加载状态
    cities[index].loaded = false;
    this.setData({ cities: cities });

    this.loadWeatherForCity(cities[index].city, index);
    wx.stopPullDownRefresh();
  }
});
