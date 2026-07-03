import request from "./request";

const userApi={
     login(username:string,password:string){
        return request.post('/user/login',null,{params:{username,password}});
     }
}
export default userApi