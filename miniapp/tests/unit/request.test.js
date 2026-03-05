// NOTE: request.js depends on the global wx object.
// In unit tests we mock wx to validate behavior without a MiniProgram runtime.

const mockWx = () => {
  global.wx = {
    showLoading: jest.fn(),
    hideLoading: jest.fn(),
    showToast: jest.fn(),
    request: jest.fn()
  };
};

describe('utils/request', () => {
  beforeEach(() => {
    jest.resetModules();
    mockWx();
  });

  test('should resolve for 2xx responses', async () => {
    // Arrange
    const { request } = require('../../utils/request');

    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { ok: true } });
    });

    // Act
    const res = await request('/api/ping');

    // Assert
    expect(res).toEqual({ ok: true });
    expect(wx.showLoading).toHaveBeenCalled();
    expect(wx.hideLoading).toHaveBeenCalled();
  });

  test('should reject and toast for non-2xx responses', async () => {
    const { request } = require('../../utils/request');

    wx.request.mockImplementation(({ success }) => {
      success({ statusCode: 500, data: { message: 'boom' } });
    });

    await expect(request('/api/ping')).rejects.toThrow('boom');
    expect(wx.showToast).toHaveBeenCalledWith({ title: 'boom', icon: 'none' });
  });

  test('should reject and toast for network errors', async () => {
    const { request } = require('../../utils/request');

    wx.request.mockImplementation(({ fail }) => {
      fail(new Error('network'));
    });

    await expect(request('/api/ping')).rejects.toThrow('network');
    expect(wx.showToast).toHaveBeenCalledWith({ title: '网络连接失败', icon: 'none' });
  });
});
