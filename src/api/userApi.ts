import request from "./request";
import type UserDto from '@/types/UserDto'

/** 登录接口返回的业务数据（位于 Result.data 内）。 */
export interface LoginResult {
   token: string
   user: UserDto
}

const userApi={
     login(username:string,password:string){
        return request.post<LoginResult>('/user/login',null,{params:{username,password}});
     },
     /**
      * 退出登录：让后端把当前 token 拉黑（服务端按 7 天窗口持久化）。
      *
      * 不带任何参数——后端从网关注入的请求头里取用户与 token，
      * 所以调用时必须保证 store 里还有 token（先调接口、再清本地）。
      *
      * silent：这一步失败时本地登出照样完成、页面照样回登录页，
      * 再弹一条「服务出了点问题」只会让用户以为自己没退出成功
      * （而且提示会落在登录页上）。失败由调用方记开发期日志。
      */
     logout(){
        return request.post<string>('/user/logout', null, { silent: true });
     },
     emailRegister(email:string,password:string,username:string){
      return request.post('/user/emailregister',null,{params:{email,password,username}});
     },
     register(number:string,code:string){
      return request.post('/user/register',null,{params:{number,code}});
     },
     /** 发送登录验证码（仅对已注册邮箱有效）。 */
     getEmailCode(email:string){
      return request.post('/user/getemailcode',null,{params:{email}});
     },
     /** 验证码方式的邮箱登录。 */
     emailLoginForCode(email:string,code:string){
      return request.post<LoginResult>('/user/emailloginforcode',null,{params:{email,code}});
     },
     /**
      * 找回密码第一步：仅发送验证码。
      * 新密码在第二步随验证码一起提交，避免未验证身份就暂存密码。
      */
     updataPasswordForEmail(email:string){
      return request.post('/user/updatepasswordforemail',null,{params:{email}})
   },
     /** 找回密码第二步：邮箱 + 验证码 + 新密码。 */
     updatefromcode(number:string,code:string,password:string){
        return request.post('/user/updatefromcode',null,{params:{number,code,password}})
     },
     /** 获取当前登录用户信息（后端从令牌推导身份，不接受入参）。 */
     getCurrentUser() {
        return request.get<UserDto>('/user/getuserbyid')
     },
     /** 查询指定用户公开信息，供作者信息/角色展示使用。 */
     getUserById(id: string) {
        return request.get<UserDto>(`/user/info/${encodeURIComponent(id)}`)
     },
     /** 管理员按 ID 查询任意用户。 */
     updatePassword(oldPassword: string, newPassword: string) {
        return request.post('/user/updatepassword', null, { params: { oldPassword, newPassword } })
     },
     /** 冻结当前账号（需密码验证，冻结期间无法登录）。 */
     freezeAccount(banReason: string, password: string) {
        return request.post('/user/freeze', null, { params: { banReason, password } })
     },
     /** 注销当前账号（后端软删除，status 置 2）。 */
     deleteAccount() {
        return request.post('/user/delete')
     },
     updateNickName(nickName: string) {
        return request.put('/user/nickname', null, { params: { nickName } })
     },
     updateBio(bio: string) {
        return request.put('/user/bio', null, { params: { bio } })
     },
     updateBirthday(birthday: string) {
        return request.put('/user/birthday', null, { params: { birthday } })
     },
     uploadAvatar(file: File) {
        const formData = new FormData()
        formData.append('file', file)
        return request.post('/user/avatar', formData, {
           headers: { 'Content-Type': 'multipart/form-data' }
        })
     }

}
export default userApi
