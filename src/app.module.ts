import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { MovieModule } from './movie/movie.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi'
import { Movie } from './movie/entity/movie.entity';
import { MovieDetail } from './movie/entity/movie-detail.entity';
import { DirectorModule } from './director/director.module';
import { Director } from './director/entity/director.entity';
import { GenreModule } from './genre/genre.module';
import { Genre } from './genre/entity/genre.entity';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { User } from './user/entities/user.entity';
import { envVariableKeys } from './common/const/env.const';
import { BearerTokenMiddleware } from './auth/middleware/bearer-token.middleware';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard } from './auth/guard/auth.guard';
import { RBACGuard } from './auth/guard/rbac.guard';
import { ResponseTimeInterceptor } from './common/interceptor/response-time.intercepter';
import { ForbiddenExceptionFilter } from './common/filter/forbidden.filter';
import { QueryFailedExceptionFilter } from './common/filter/query-failed.filter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MovieUserLike } from './movie/entity/movie-user-like.entity';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottleInterceptor } from './common/interceptor/throttle.interceptor';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 어떤 모듈에서든 ConfigModule에 등록된 환경변수 사용 가능
      envFilePath: process.env.NODE_ENV === 'test' ? 'test.env' : '.env', // e2e 테스트를 위해 추가. 
      validationSchema: Joi.object({ // Joi Validation
        ENV: Joi.string().valid('test', 'dev', 'prod').required(),
        DB_TYPE: Joi.string().valid('postgres').required(),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().required(),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_DATABASE: Joi.string().required(),
        HASH_ROUNDS: Joi.number().required(),
        ACCESS_TOKEN_SECRET: Joi.string().required(),
        REFRESH_TOKEN_SECRET: Joi.string().required(),
      })
    }),
    // forRootAsync()
    // 비동기 이유: ConfigModule이 인스턴스화 된 후에(위의 것들이 ioc컨테이너에 이미 생긴 후에)
    //            위의 것들을 여기에 inject받을 것이기 때문
    // 즉, configModule에 설정된 값을 기반으로 연결정보를 만들어야 함
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({ // ConfigService 주입
        type: configService.get<string>(envVariableKeys.dbType) as "postgres",
        host: configService.get<string>(envVariableKeys.dbHost),
        port: configService.get<number>(envVariableKeys.dbPort),
        username: configService.get<string>(envVariableKeys.dbUsername),
        password: configService.get<string>(envVariableKeys.dbPassword),
        database: configService.get<string>(envVariableKeys.dbDatabase),
        entities: [
          Movie,
          MovieDetail,
          Director,
          Genre,
          User,
          MovieUserLike,
        ],
        synchronize: true, 
      }),
      inject: [ConfigService] // TypeOrmModule.forRootAsync()를 만들 때, IOC 컨테이너에서 ConfigService를 dependency injection을 해줘야 한다고 알려주기 위함
    }),

    // NestJS에서는 process.env 방식으로 환경변수를 잘 쓰지 않음
    // TypeOrmModule.forRoot({
    //   type: process.env.DB_TYPE as "postgres", // 연동할 DB
    //   host: process.env.DB_HOST,
    //   port: parseInt(process.env.DB_PORT as string),
    //   username: process.env.DB_USERNAME,
    //   password: process.env.DB_PASSWORD,
    //   database: process.env.DB_DATABASE,
    //   entities: [],
    //   synchronize: true, // only 개발할 때만 true. 프로덕션에서는 false
    // }),
    ServeStaticModule.forRoot({
      // 이렇게 하면 postman에서 public폴더만 접근 가능
      // 파일을 찾을 때는 rootPath를 사용하고
      // 이 경로에 있는 파일을 가져오기 위해서는 serveRoot가 필요
      rootPath: join(process.cwd(), 'public'), // 어떤 폴더로부터 파일들을 서빙할지
      serveRoot: '/public/'
    }),
    CacheModule.register({
      ttl: 0, // TTL 기본 옵션 지정 가능
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    WinstonModule.forRoot({
      // 아무것도 안넣으면 트랜스포트 없이 로그를 작성하려고 했다는 로그가 나옴(일종의 경고)
      // 트랜스포트 - 로그 작성 시 어디로 어떻게 전달이 될지 정하는 요소
      // 실제로 서버 배포 시 로그가 쌓여야 함(어딘가(매개체)에 저장되야 함)
      // 윈스턴에서는 이 매개체들을 트랜스포트라고 함. HTTP 트랜스포트, 콘솔 트랜스포트 등 다양함
      level: 'debug', // 로깅할 최소 레벨
      transports: [
        new winston.transports.Console({
          format: winston.format.combine( 
            winston.format.colorize({ // 이거 넣으면 색깔 넣기 가능
              all: true,
            }),
            winston.format.timestamp(),
            // printf() - 어떤 포맷이든 맘대로 만들기 가능
            winston.format.printf(info => `${info.timestamp} [${info.context}] ${info.level} ${info.message}`) 
          ),
        }),
        new winston.transports.File({ // 파일 트랜스포트
          dirname: join(process.cwd(), 'logs'), // 로그 저장할 디렉터리 이름
          filename: 'logs.log',
          // 파일에서도 포맷 설정 가능
          format: winston.format.combine( 
            // winston.format.colorize({ // 이거 넣으면 색깔 넣기 가능
            //   all: true,
            // }),
            winston.format.timestamp(),
            // printf() - 어떤 포맷이든 맘대로 만들기 가능
            winston.format.printf(info => `${info.timestamp} [${info.context}] ${info.level} ${info.message}`) 
          ),
        })
      ]
    }),
    MovieModule,
    DirectorModule,
    GenreModule,
    AuthModule, 
    UserModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RBACGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTimeInterceptor,
    },
    // {
    //   provide: APP_FILTER,
    //   useClass: ForbiddenExceptionFilter,
    // },
    {
      provide: APP_FILTER,
      useClass: QueryFailedExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ThrottleInterceptor,
    },
  ]
})
export class AppModule implements NestModule{
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(
      BearerTokenMiddleware,
    ).exclude({
      path: 'auth/login',
      method: RequestMethod.POST,
      // version: ['1', '2'], // 여기에도 적용해줘야 함
    }, {
      path: 'auth/register',
      method: RequestMethod.POST,
      // version: ['1', '2'],
    })
    .forRoutes('*')
  }
}
