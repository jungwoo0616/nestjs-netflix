import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, of, tap } from "rxjs";

@Injectable()
export class CacheInterceptor implements NestInterceptor{
    private cache = new Map<string, any>();

    intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
        const request = context.switchToHttp().getRequest();

        const key = `${request.method}-${request.path}`

        if(this.cache.has(key)){
            return of(this.cache.get(key)) // of() 사용 시 일반 변수를 Observable로 반환 가능
        }

        return next.handle()
        .pipe(
            tap(response => this.cache.set(key, response)),
        ) 
    }
    
}