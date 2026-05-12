import { Cache, CACHE_MANAGER } from "@nestjs/cache-manager";
import { BadRequestException, Inject, Injectable, NestMiddleware, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { NextFunction, Request, Response } from "express" 
import { envVariableKeys } from "src/common/const/env.const";

// basic토큰은 로그인/회원가입 때만 사용 -> 굳이 미들웨어 필요 없음
// basic토큰은 따로 exclude 해줄 것임
// bearer토큰은 인증이 필요한 모든 라우트에 적용이 되야 함 -> 미들웨어로 구현

@Injectable()
export class BearerTokenMiddleware implements NestMiddleware {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
    ){}


    async use(req: Request, res: Response, next: NextFunction) {
        const authHeader = req.headers['authorization']

        if(!authHeader){ // 인증할 의도 자체가 없다면
            next();
            return;
        }

        const token = this.validateBearerToken(authHeader);

        const blockedToken = await this.cacheManager.get(`BLOCK_TOKEN_${token}`);

        if(blockedToken){
            throw new UnauthorizedException('차단된 토큰입니다!');
        }

        const tokenKey = `TOKEN_${token}`;
        
        const cachedPayload = await this.cacheManager.get(tokenKey);

        if(cachedPayload) { // 이거 있으면 밑에서 토큰 만료되기 전 동안 재검증 필요 없음
            console.log('---- cache run ----');
            req.user = cachedPayload;

            return next();
        }

        // decode() - 검증하지 않고 내용을 볼 수 있는 메서드
        const decodedPayload = this.jwtService.decode(token);

        if(decodedPayload.type !== 'refresh' && decodedPayload.type !== 'access'){
            throw new UnauthorizedException('잘못된 토큰입니다!');
        }

        try{
            const secretKey = decodedPayload.type === 'refresh' ? 
                        envVariableKeys.refreshTokenSecret : 
                        envVariableKeys.accessTokenSecret

            // verifyAsync() - payload 가져옴 + 검증
            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.get<string>(
                    secretKey,
                ),
            });
            // 페이로드를 한번 검증하고나면 그 토큰이 valid하다는 것을 만료기간이 지나기 전까지는 보장 가능
            // -> 만료되기 전까지 토큰을 캐시에 저장해서 메모리에서 빼서 반환해주면 됨

            // payload['exp'] -> epoch time seconds(1070년부터 초 단위로 센 값이 들어있음)
            const expiryDate = + new Date(payload['exp'] * 1000); // ms로 제공해야 하므로 1000을 곱함
            const now = + Date.now();

            const differenceInSeconds = (expiryDate - now) / 1000; // 초 단위로 변환(/1000)

            await this.cacheManager.set(tokenKey, payload, 
                Math.max((differenceInSeconds - 30) * 1000, 1) 
                // differenceInSeconds - 30 -> 캐시 하는데 걸리는 시간도 고려
                // Math.max() - 음수 방지
            )

            req.user = payload;
            next();
        }catch(e){
            // throw new UnauthorizedException('토큰이 만료됐습니다!')
            if(e.name === 'TokenExpiredError'){
                throw new UnauthorizedException('토큰이 만료됐습니다.');
            }
            next(); // 에러는 이제 AuthGuard에서 잡으면 됨
            // 여기서 에러를 잡으면 @Public()을 적용해도 토큰이 만료되었다는 에러가 나올 수 있음
            // 프론트엔드에서는 private/public 라우트 고려하지 않고 무조건 bearer토큰을 보내는 경향이 있음
            // -> 각 라우트의 권한을 모두 고려하기에는 너무 귀찮으니까...
        }
    }


    validateBearerToken(rawToken: string){ 
        const basicSplit = rawToken.split(' ');

        if(basicSplit.length !== 2){
            throw new BadRequestException('토큰 포맷이 잘못됐습니다!');
        }

        const [bearer, token] = basicSplit;

        if(bearer.toLowerCase() !== 'bearer'){
            throw new BadRequestException('토큰 포맷이 잘못됐습니다!');
        }

        return token;
    }
}