// 日期格式化工具

const DateFormat = {
  /**
   * 格式化日期
   * @param {string|Date} date - 日期
   * @param {string} format - 格式模板
   */
  format(date, format = 'YYYY-MM-DD') {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  },

  /**
   * 获取相对时间
   * @param {string|Date} date - 日期
   */
  fromNow(date) {
    if (!date) return '';
    
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 30) {
      return this.format(date, 'YYYY年MM月DD日');
    } else if (days > 0) {
      return `${days}天前`;
    } else if (hours > 0) {
      return `${hours}小时前`;
    } else if (minutes > 0) {
      return `${minutes}分钟前`;
    } else {
      return '刚刚';
    }
  },

  /**
   * 获取月份标签
   * @param {number} year - 年份
   * @param {number} month - 月份
   */
  getMonthLabel(year, month) {
    return `${year}年${month}月`;
  },

  /**
   * 计算宝宝月龄
   * @param {string|Date} birthDate - 生日
   */
  getBabyAge(birthDate) {
    if (!birthDate) return '';
    
    const birth = new Date(birthDate);
    const now = new Date();
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    
    if (months < 0) return '还未出生';
    if (months === 0) return '新生儿';
    if (months === 1) return '1个月';
    if (months < 12) return `${months}个月`;
    
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return `${years}岁`;
    return `${years}岁${remainingMonths}个月`;
  }
};

module.exports = DateFormat;
