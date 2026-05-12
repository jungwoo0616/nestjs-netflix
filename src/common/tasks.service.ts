import { Inject, Injectable } from "@nestjs/common";
import type { LoggerService } from "@nestjs/common";
import { Cron, SchedulerRegistry } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { readdir, unlink } from "fs/promises";
import { join, parse } from "path";
import { Movie } from "src/movie/entity/movie.entity";
import { Repository } from "typeorm";
import { Logger } from "@nestjs/common";
import { DefaultLogger } from "./logger/default.logger";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";

// TasksService를 common.module.ts의 providers에 넣어줘야 실행 가능

@Injectable()
export class TasksService {
    // Part 25. Logging
    // Logger()
    // 괄호 안에 컨텍스트(어떤 부분에서 어떤 로그를 작성한 것인지 알 수 있는 내용) 넣을 수 있음
    // private readonly logger = new Logger(TasksService.name); 

    constructor(
        @InjectRepository(Movie)
        private readonly movieRepository: Repository<Movie>,
        private readonly schedulerRegistry: SchedulerRegistry,
        //private readonly logger: DefaultLogger,
        @Inject(WINSTON_MODULE_NEST_PROVIDER)
        private readonly logger: LoggerService,
    ){}

    // Part 25. Logging
    // '초 분 시 일 월 요일'
    // @Cron('*/5 * * * * *') // 이것만 있으면 됨
    logEverySecond(){
        // console.log('1초마다 실행!');
        // this.logger.log('1초마다 실행!');

        // 아래의 순서가 nestjs에서 제공해주는 중요도 순서(이 순서는 무조건 지켜야 함)
        // fatal에 가까울수록 무조건 보여야 되는 로그
        // verbose에 가까울수록 안보여도 되는 로그
        this.logger.fatal?.('FATAL 레벨 로그', null, TasksService.name); // 지금 당장 해결해야 하는 문제일 때 사용
        this.logger.error('ERROR 레벨 로그', null, TasksService.name); // 에러가 났을 때 사용
        this.logger.warn('WARN 레벨 로그', TasksService.name); // 냅둬도 크게 문제가 되지 않지만 일어나면 안 좋은 상황일 때 사용
        this.logger.log('LOG 레벨 로그', TasksService.name); // 정보성 로그를 작성할 때 사용
        this.logger.debug?.('DEBUG 레벨 로그', TasksService.name); // 프로덕션 환경이 아니라 개발 환경에서 중요한 로그를 작성할 때 사용
        this.logger.verbose?.('VERBOSE 레벨 로그', TasksService.name); // 진짜 중요하지 않은 것들 로깅해볼 때 사용
        // 윈스턴 사용 시에는 ?. 붙여야 하는 메서드가 좀 있음...
        // 두번째 파라미터인 TasksService.name와 같이 context를 넣어줄 수 있음
    }

    // '초 분 시 일 월 요일'
    // @Cron('* * * * * *')
    // pulbic/temp폴더에 있는 잉여 파일 자동 삭제 기능 구현
    async eraseOrphanFiles(){
        // readdir() - 디렉터리 안에 있는 모든 파일을 가져올 수 있음
        const files = await readdir(join(process.cwd(), 'public', 'temp')) 
        
        // 파일 이름이 잘못 되었거나 24시간이 지난 파일을 true로 반환하여
        // 삭제 타깃 변수(리스트)에 넣기
        const deleteFilesTargets = files.filter((file)=> {
            const filename = parse(file).name; // .mp4(확장자)를 제외한 파일명

            const split = filename.split('_');

            if(split.length !== 2){
                return true;
            }

            try{
                const date = +new Date(parseInt(split[split.length - 1]));
                const aDayInMilSec = (24 * 60 * 60 * 1000); /// 24h를 ms로 환산

                const now = + new Date();

                return (now - date) > aDayInMilSec

            }catch(e){
                return true; // 잘못된 파일명이면 삭제 리스트에 포함
            }
        });

        // all() 안에는 여러개의 async 함수 들어갈 수 있음
        // 이 함수들을 모두 병렬 실행 시키고 await는 이 안에 모든 함수가 끝났을때 반환됨
        await Promise.all(
            deleteFilesTargets.map(
                (x) => unlink(join(process.cwd(), 'public', 'temp', x))
            )
        )
    }
    
    // @Cron('0 * * * * *') // 매 0초마다 실행
    async calculateMovidLikeCounts(){
        console.log('run');

        await this.movieRepository.query(
            `UPDATE movie m
            SET "likeCount" = (
                SELECT count(*) FROM movie_user_like mul
                WHERE m.id = mul."movieId" AND mul."isLike" = true
            )`
        );

        await this.movieRepository.query(
            `UPDATE movie m
            SET "dislikeCount" = (
                SELECT count(*) FROM movie_user_like mul
                WHERE m.id = mul."movieId" AND mul."isLike" = false
            )`
        );
    }


    // 아래의 코드들은 그냥.. 이런게 있다..(가급적이면 위에서 한 코드를 사용)

    // @Cron('* * * * * *', {
    //     name: 'printer',
    // })
    // printer(){
    //     console.log('print every seconds')
    // }

    // @Cron('*/5 * * * * *') // 5초마다 실행
    // stopper(){
    //     console.log('---stopper run---')

    //     // job에는 위의 printer()의 cron job 정보가 들어감
    //     const job = this.schedulerRegistry.getCronJob('printer');

    //     console.log('# Last Date');
    //     console.log(job.lastDate());
    //     console.log('# Next Date');
    //     console.log(job.nextDate());
    //     console.log('# Next Dates');
    //     console.log(job.nextDates(5));

    //     if(job.isActive){ // job이 실행중이면
    //         job.stop(); // printer() 크론이 중지됨
    //     }else{
    //         job.start();
    //     }
    // }
}
