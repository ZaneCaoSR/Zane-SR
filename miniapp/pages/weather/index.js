// 天气首页
const { BASE_URL } = require('../../utils/config');
const app = getApp();

// 天气主题映射
const getWeatherTheme = (weather) => {
  if (!weather) return 'theme-sunny';
  const w = weather.toLowerCase();
  if (w.includes('晴')) return 'theme-sunny';
  if (w.includes('多云')) return 'theme-cloudy';
  if (w.includes('阴')) return 'theme-cloudy';
  if (w.includes('雨')) return 'theme-rainy';
  if (w.includes('雪')) return 'theme-snowy';
  if (w.includes('雾') || w.includes('霾')) return 'theme-foggy';
  if (w.includes('雷')) return 'theme-stormy';
  return 'theme-sunny';
};

// 天气提示生成
const getWeatherTips = (weather, temp, humidity, air) => {
  const tips = [];

  if (!weather) return tips;

  const w = weather.toLowerCase();
  const t = parseInt(temp) || 0;
  const h = parseInt(humidity) || 0;

  // 天气相关
  if (w.includes('雨') || w.includes('暴雨') || w.includes('大雨')) {
    tips.push({ icon: '☔', text: '记得带伞哦，开车慢行' });
  }
  if (w.includes('雪')) {
    tips.push({ icon: '⛄', text: '注意防寒保暖，路面湿滑' });
  }
  if (w.includes('雾') || w.includes('霾')) {
    tips.push({ icon: '😷', text: '能见度低，出行注意安全' });
  }
  if (w.includes('晴') && t > 30) {
    tips.push({ icon: '☀️', text: '高温预警，注意防暑' });
  }
  if (w.includes('晴') && t < 5) {
    tips.push({ icon: '🧥', text: '天气寒冷，注意保暖' });
  }
  if (w.includes('雷')) {
    tips.push({ icon: '⛈️', text: '雷电天气，避免户外活动' });
  }
  if (w.includes('晴') && t >= 15 && t <= 28) {
    tips.push({ icon: '🌸', text: '天气宜人，适合外出' });
  }

  // 温度相关
  if (t > 35) {
    tips.push({ icon: '🥵', text: '高温预警，多补充水分' });
  }
  if (t < 0) {
    tips.push({ icon: '🥶', text: '寒冷天气，注意防冻' });
  }

  // 湿度相关
  if (h > 80) {
    tips.push({ icon: '💧', text: '空气潮湿，注意除湿' });
  }

  // 空气质量
  if (air && air.category) {
    if (air.category === '优') {
      tips.push({ icon: '🍃', text: '空气优秀，宜户外运动' });
    } else if (air.category.includes('重度') || air.category.includes('严重')) {
      tips.push({ icon: '😷', text: '空气污染，建议戴口罩' });
    }
  }

  // 默认提示
  if (tips.length === 0) {
    tips.push({ icon: '💡', text: '关注天气，享受生活' });
  }

  return tips;
};

// 舒适度计算
const getComfortLevel = (temp, humidity) => {
  const t = parseInt(temp) || 20;
  const h = parseInt(humidity) || 50;

  let score = 100;
  let level = '舒适';
  let icon = '😊';

  // 温度影响
  if (t < 5) {
    score -= (5 - t) * 5;
    level = '寒冷';
    icon = '🥶';
  } else if (t < 10) {
    score -= (10 - t) * 3;
    level = '较冷';
    icon = '😨';
  } else if (t < 18) {
    score -= Math.abs(18 - t) * 2;
    level = '偏凉';
    icon = '🙂';
  } else if (t > 35) {
    score -= (t - 35) * 5;
    level = '炎热';
    icon = '🥵';
  } else if (t > 30) {
    score -= (t - 30) * 3;
    level = '较热';
    icon = '😓';
  } else if (t > 28) {
    score -= Math.abs(28 - t) * 2;
    level = '偏热';
    icon = '🙂';
  }

  // 湿度影响
  if (h > 80) {
    score -= (h - 80) * 0.5;
    level = h > 90 ? '闷热' : level;
    icon = h > 90 ? '🥵' : icon;
  } else if (h < 30) {
    score -= (30 - h) * 0.3;
    level = h < 20 ? '干燥' : level;
    icon = h < 20 ? '😫' : icon;
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= 80) {
    level = '舒适';
    icon = '😊';
  } else if (score >= 60) {
    level = '较舒适';
    icon = '🙂';
  } else if (score >= 40) {
    level = '较不舒适';
    icon = '😐';
  } else {
    level = '不舒适';
    icon = '😫';
  }

  return { score, level, icon };
};

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

  // 天气主题过滤器
  getWeatherTheme(weather) {
    return getWeatherTheme(weather);
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
          const weatherData = res.data;
          // 转换 alerts 的 level 为英文类名
          if (weatherData.alerts && weatherData.alerts.length > 0) {
            const levelMap = { '橙色': 'orange', '红色': 'red', '黄色': 'yellow', '蓝色': 'blue', '其他': 'other' };
            weatherData.alerts = weatherData.alerts.map(alert => ({
              ...alert,
              level: levelMap[alert.level] || 'other'
            }));
          }
          cities[idx].weatherData = weatherData;
          cities[idx].weatherTheme = getWeatherTheme(res.data.weather);
          // 添加天气提示
          cities[idx].weatherTips = getWeatherTips(
            res.data.weather,
            res.data.temp,
            res.data.humidity,
            res.data.air
          );
          // 添加舒适度
          cities[idx].comfort = getComfortLevel(res.data.temp, res.data.humidity);
          cities[idx].loaded = true;
          cities[idx].loading = false;
          this.setData({ cities: cities });

          // 更新时间
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          this.setData({ updateTime: timeStr, loading: false });

          // 加载生活指数
          this.loadWeatherIndices(city, idx);
        }
      },
      fail: (err) => {
        console.error(`[Weather] 获取 ${city} 天气失败:`, err);
        cities[idx].loading = false;
        this.setData({ cities: cities, loading: false });
      }
    });
  },

  // 加载生活指数
  loadWeatherIndices(city, index) {
    const cities = this.data.cities;

    wx.request({
      url: `${BASE_URL}/api/cities/search?keyword=${encodeURIComponent(city)}`,
      success: (res) => {
        if (res.data && res.data.cities && res.data.cities.length > 0) {
          const cityId = res.data.cities[0].id;
          // 获取生活指数
          wx.request({
            url: `${BASE_URL}/api/weather-indices/${cityId}`,
            success: (indicesRes) => {
              if (indicesRes.data) {
                cities[index].indices = indicesRes.data;
                this.setData({ cities: cities });
              }
            }
          });
        }
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
  },

  // 分享天气
  onShareAppMessage() {
    const currentCity = this.data.cities[this.data.currentCityIndex];
    const weather = currentCity.weatherData;

    return {
      title: `${currentCity.city}今日天气：${weather.weather || ''} ${weather.temp || ''}°`,
      path: `/pages/weather/index`
    };
  }
});
