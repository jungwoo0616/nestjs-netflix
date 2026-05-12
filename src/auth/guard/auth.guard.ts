import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Public } from "../decorator/public.decorator";

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
    ){}
    canActivate(context: ExecutionContext): boolean {
        // 만약에 public decoration이 되어 있으면 모든 로직을 bypass
        const isPublic = this.reflector.get(Public, context.getHandler()); 
        
        // console.log(isPublic); 
        // isPublic에는 @Public()에 입력한 객체가 들어옴 (ex. Public('aaa')) -> aaa
        // @Public() 지정을 안하면  undefined가 나옴

        if(isPublic){ // 객체({})는 무조건 true
            return true;
        }


        // 요청에서 user 객체가 존재하는지 확인한다.
        const request = context.switchToHttp().getRequest();

        if(!request.user || request.user.type !== 'access'){
            return false;
        }

        return true;
    }
}