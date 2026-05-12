import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['verbose'], // 리스트에 로그 레벨을 넣으면 그 레벨 포함 상위 레벨의 로그까지 다 보임
  });

  // Swagger Documentation 만들기
  const config = new DocumentBuilder()
  .setTitle('코드팩토리 넷플릭스') // Swagger Documentation의 이름
  .setDescription('코드팩토리 NestJS 강의!')
  .setVersion('1.0') // Swagger Documentation의 버전
  .addBasicAuth()
  .addBearerAuth()
  .build();

  // 웹사이트에 http://localhost:3000/doc 이라고 치면 api가 잘 정리되서 나옴
  // nest-cli.json에 "plugins": ["@nestjs/swagger"]를 넣으면 
  // 우리가 만든 엔티티, DTO들을 기반으로 자동으로 파라미터나 쿼리 등을 생성해줌

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('doc', app, document, { // 첫번째 파라미터 - 어디에 셋업할지(일종의 prefix)
    swaggerOptions: {
      persistAuthorization: true, // http://localhost:3000/doc에서 새로고침해도 로그인 그대로 유지
    }
  }) 

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER))
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // 정의되지 않는 값(프로퍼티)은 입력 불가
    forbidNonWhitelisted: true, // 정의되지 않는 값(프로퍼티)에 대해 에러 발생 
    transformOptions: {
      enableImplicitConversion: true, // ex. DTO에서 타입스크립트 타입 기반으로 입력 값들을 그 타입에 맞게 변경
    }
  }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
