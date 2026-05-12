import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard, PassportStrategy } from "@nestjs/passport"
import { ExtractJwt, Strategy } from "passport-jwt";

export class JwtAuthGuard extends AuthGuard('jwt'){};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy){
    constructor(
        private readonly configService: ConfigService,
    ){
        super({
            // 어디에세 jwt를 추출할 것인지
            // 우리는 bearer 토큰에서 추출
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false, // 토큰 만료기간 무시하고서 토큰을 검증할지 - false로 설정
            secretOrKey: configService.get<string>('ACCESS_TOKEN_SECRET')!,
        });
    }

    // validate에 payload가 들어옴(이렇게 되도록 구현됨)
    validate(payload: any){
        return payload;
    }
}