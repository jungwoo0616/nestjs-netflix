// 이메일과 비번으로 로그인할 수 있는 전략을 만듬

import { Injectable } from "@nestjs/common";
import { AuthGuard, PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { AuthService } from "../auth.service";


export class LocalAuthGuard extends AuthGuard('local'){}


@Injectable() // 모든 Strategy는 프로바이더로 사용 -> @Injectable() 필수
export class LocalStrategy extends PassportStrategy(Strategy){ // local strategy의 strategy전략이 들어감
    constructor(
        private readonly authService: AuthService, // LocalStrategy 클래스도 @Injectable() 적용 -> 주입 받을 수 있음
    ){
        // 모든 Strategy는 super constructor를 불러줘야 함
        super({
            usernameField: 'email' // username이라고 되어있는 이름을 email로 변경(스트레티지 제공 기능)
        }); 
    }

    // Strategy에서 제공해주는 값으로 실제로 존재하는 사용자인지 검증해야 함
    /**
     * LocalStrategy
     * validate : username, password -> 이걸 자동으로 넣어줌(정해져 있음)
     * 이 두개를 postman의 body에 json 형태로 입력해줘야 함(이전에 했던 basic 토큰 사용과는 다름)
     * 
     * return -> Request(); 객체로 받을 수 있음(이 스트레티지를 적용한 컨트롤러에서)
     */
    async validate(email: string, password: string){
        const user = await this.authService.authenticate(email, password);

        return user;
    }
}