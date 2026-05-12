import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { QueryFailedError } from "typeorm";

@Catch(QueryFailedError)
export class QueryFailedExceptionFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();

        // QueryFailedError는 typeorm것이라 exception.getStatus() 없음
        // 그냥 400 이라고 하자 - 클라이언트에서 뭔가 잘못된 값을 넣었기 때문에 데이터베이스 에러가 난 것이기 때문
        const status = 400;
        
        let message = '데이터베이스 에러 발생!';

        // duplicate key라는 말이 들어간 typeorm에러가 나면 
        if(exception.message.includes('중복된 키')){
            message = '중복 키 에러!'; // 이 메세지로 덮어씀
        }

        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message,
        })
    }
}

// 당연히 각 service.ts파일의 함수 각각에서 에러 처리를 해주면 좋지만 까먹으면?
// 그걸 예방하기 위해 필요한 코드