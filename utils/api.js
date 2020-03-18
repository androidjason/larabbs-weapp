import wepy from 'wepy'

//服务器接口地址
const host = 'http://larabbs.test/'

//普通请求
const request  = async(options,showLoading = true) => {
  //简化开发 如果传入的是字符串 转化为对象
  if (typeof options === 'string') {
    options = {
      url : options
    }
  }
  //显示加载中
  if (showLoading) {
    wepy.showLoading({title:'加载中'})
  }
  //拼接请求地址
  options.url = host + '/' +options.url
  //调用小程序的 request 方法
  let response = await wepy.request(options)
  //隐藏加载中
  if (showLoading) {
    wepy.hideLoading()
  }
  //服务器异常给提示
  if (response.statusCode === 500) {
    wepy.showModal({
      title:'提示',
      content:'服务器错误，请联系接口'
    })
  }
  //返回请求结果
  return response
}

//登录
const login = async (params = {})=> {
  //code只能使用一次，所以每次单独调用 用let
  let loginData  = await wepy.login()

  //参数中增加code
  params.code = loginData.code

  //请求接口 weapp/authorizations
  let authResponse = await request({
    url:'weapp/authorizations',
    data:params,
    method:'POST'
  })

  //登录成功 把token写入小程序缓存
  if(authResponse.statusCode === 201){
    wepy.setStorageSync('access_token',authResponse.data.access_token)
    wepy.setStorageSync('access_token_expired_at',new Date().getTime()+authResponse.data.expires_in * 1000)
  }

  //返回请求结果
  return authResponse
}

//刷新token
const refreshToken = async(accessToken)=>{
  //请求刷新接口 老的token换新的token
  let refreshResponse = await wepy.request({
    url:host + '/' + 'authorizations/current',
    method:'PUT',
    header{
      'Authorization':'Bearer' + accessToken
    }
  })

  //刷新成功写入缓存
  if (refreshResponse.statusCode === 200) {
    //将更新后的token和过期时间写入到缓存中
    wepy.setStorageSync('access_token',refreshResponse.data.access_token)
    wepy.setStorageSync('access_token_expired_at',new Date().getTime() + refreshResponse.data.expires_in * 1000)
  }
  //返回token值 供外部调用
  return refreshToken
}

//封装获得token的方法
const getToken = async(options)=>{
  //从缓存中拿token
  let accessToken = wepy.getStorageSync('access_token')
  let expiredAt = wepy.getStorageSync('access_token_expired_at')

  //判断token是否存在且有效期内，不满足条件则刷新token 获得调用login获得token
  if (!accessToken || new Date().getTime() > expiredAt) {
    let refreshResponse = await refreshToken(accessToken)

    //刷新成功
    if (refreshResponse.statusCode === 200) {
      accessToken = refreshResponse.data.access_token
    }else{ //刷新失败 可能因为超过了刷新时间 需要重新登录获得 token
      let authResponse = await login()
      if (authResponse.statusCode === 201) {
        accessToken = authResponse.data.access_token
      }

    }
  }

  //token满足条件 直接返回
  return accessToken
}

//带身份认证的请求
const authRequest = async(options,showLoading = true)=>{
  //如果是字符串转为对象 兼容更多的场景
  if (typeof options === 'string') {
    options = {
      url:options
    }
  }

  //获得token
  let accessToken = await getToken()

  //将token设置到header中
  let header = options.header || {}
  header.Authorization = 'Bearer' + accessToken
  options.header = header

  return request(options,showLoading)
}

//退出登录
const logout = async(params = {})=>{
  let accessToken = wepy.getStorageSync('access_token')
  //请求删除token的接口 让token失效
  let logoutResponse = await wepy.request({
    url:host + '/' + 'authorizations/current',
    method:'DELETE',
    header:{
      'Authorization':'Bearer'+accessToken
    }
  })

  //token失效后，删除小程序本地的缓存
  if (logoutResponse.statusCode === 204) {
    wepy.clearStorage()
  }

  //返回清空结果
  return logoutResponse
}

//输出两个方法 方便其他模块引入调用
export default {
  request,
  refreshToken,
  getToken,
  authRequest,
  logout,
  login
}
