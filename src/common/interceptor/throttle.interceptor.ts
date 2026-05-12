import { CallHandler, ExecutionContext, ForbiddenException, Inject, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { Cache, CACHE_MANAGER } from "@nestjs/cache-manager";
import { Reflector } from "@nestjs/core";
import { Throttle } from "src/common/decorator/throttle.decorator";

// 어떤 유저가 일정 시간 동안 일정량 이상의 요청을 했을 시에 이를 제한하는 인터셉터
// 이걸 Throttling이라고 함

@Injectable()
export class ThrottleInterceptor implements NestInterceptor {
    constructor(
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
        private readonly reflector: Reflector,
    ) {}

    async intercept(context: ExecutionContext, next: CallHandler<any>): Promise<Observable<any>> {
        const request = context.switchToHttp().getRequest();

        // 캐시 키 - URL_USERID_MINUTE
        // 캐시 값 - VALUE -> count

        const userId = request?.user?.sub;


        if(!userId){ // 로그인 하지 않있다면
            return next.handle(); // 그냥 패스
        } 

        const throttleOptions = this.reflector.get<{
            count: number,
            unit: 'minute',
        }>(Throttle, context.getHandler());

        if(!throttleOptions){ // Throttle 데코레이터 없으면
            return next.handle(); // 그냥 패스
        }

        const date = new Date();
        const minute = date.getMinutes();

        const key = `${request.method}_${request.path}_${userId}_${minute}`

        const count = await this.cacheManager.get<number>(key);

        console.log(key);
        console.log(count);

        if(count && count >= throttleOptions.count){
            throw new ForbiddenException('요청 가능 횟수를 넘어섰습니다!');
        }

        return next.handle()
            .pipe(
                tap(
                    async ()=>{
                        const count = await this.cacheManager.get<number>(key) ?? 0;

                        await this.cacheManager.set(key, count + 1, 60000);
                    }
                )
            )
    }
}