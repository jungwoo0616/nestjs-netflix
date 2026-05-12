import { ConsoleLogger, Injectable } from "@nestjs/common";


// 클래스를 그대로 정의하면 기본 로거들의 기능을 상속 못받음
// ConsoleLogger 상속 받음 - 이러면 가능
// 콘솔에 로깅하는 기능 자체를 기본으로 제공하는 클래스

@Injectable()
export class DefaultLogger extends ConsoleLogger {
    warn(message: unknown, ...rest: unknown[]): void {
        // 지금은 그냥 console.log()만 했지만 이거 말고 다른 매체 등에 로그를 쏴주거나 저장하는 코드 넣기 가능
        console.log('----WARN LOG ----')
        super.warn(message, ...rest); // ConsoleLogger의 warn 기능을 그대로 실행
    }

    error(message: unknown, ...rest: unknown[]): void {
        console.log('----ERROR LOG ----')
        super.warn(message, ...rest); // ConsoleLogger의 warn 기능을 그대로 실행
    }
}

// common.modult.ts의 프로바이더에 DefaultLogger 넣어주면 사용 가능
// exports에 넣으면 다른 모듈에서도 사용 가능
// tasks.service.ts에 주입해서 사용하면 됨 