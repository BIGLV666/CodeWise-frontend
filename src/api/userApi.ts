import request from "./request";

const userApi={
     login(username:string,password:string){
        return request.post('/user/login',null,{params:{username,password}});
     },
     emailRegister(email:string,password:string,username:string){
      return request.post('/user/emailregister',null,{params:{email,password,username}});
     },
     register(number:string,code:string){
      return request.post('/user/register',null,{params:{number,code}});
     },
     updataPasswordForEmail(email:string,password:string){
      return request.post('/user/updatepasswordforemail',null,{params:{email,password}})
   },
     updatefromcode(number:string,code:string){
        return request.post('/user/updatefromcode',null,{params:{number,code}})
     },
     getUserById(id: string) {
        return request.get('/user/getuserbyid', { params: { id } })
     }

}
export default userApi
