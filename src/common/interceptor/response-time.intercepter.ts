import { CallHandler, ExecutionContext, Injectable, InternalServerErrorException, NestInterceptor } from "@nestjs/common";
import { delay, Observable, tap } from "rxjs";

@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
        const req = context.switchToHttp().getRequest();

        const reqTime = Date.now();

        return next.handle()
            .pipe(
                // delay(1000), // 1초동안 기다림(pipe()안의 함수는 순서대로 실행되므로 이게 먼저 실행됨)
                tap(() => {
                    const respTime = Date.now();
                    const diff = respTime - reqTime;
                    
                    console.log(`[${req.method} ${req.path}] ${diff}ms`);
                    // if(diff > 1000){
                    //     console.log(`!!!TIMEOUT!!! [${req.method} ${req.path}] ${diff}ms`);

                    //     throw new InternalServerErrorException('시간이 너무 오래 걸렸습니다!');
                    // }else{
                    //     console.log(`[${req.method} ${req.path}] ${diff}ms`);
                    // }
                    
                })
            )
    }
}