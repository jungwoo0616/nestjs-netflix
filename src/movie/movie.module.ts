import { Module } from '@nestjs/common';
import { MovieService } from './movie.service';
import { MovieController } from './movie.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from './entity/movie.entity';
import { MovieDetail } from './entity/movie-detail.entity';
import { Director } from 'src/director/entity/director.entity';
import { Genre } from 'src/genre/entity/genre.entity';
import { CommonModule } from 'src/common/common.module';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { v4 } from 'uuid';
import { User } from 'src/user/entities/user.entity';
import { MovieUserLike } from './entity/movie-user-like.entity';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Movie,
      MovieDetail,
      MovieUserLike,
      Director,
      Genre,
      User,
    ]),
    CommonModule,

    // MulterModule.register({
    //   storage: diskStorage({
    //     // 파일 저장 위치
    //     destination: join(process.cwd(), 'public', 'movie'),
    //     filename: (req, file, cb) => {
    //       const split = file.originalname.split('.');

    //       let extension = 'mp4';

    //       if(split.length > 1){
    //         extension = split[split.length-1];
    //       }
  
    //       cb(null, `${v4()}_${Date.now()}.${extension}`); // 두번째 파라미터에 원하는 파일명 입력
    //       // Date.now()로 언제 이 파일이 업로드 됬는지 확인 가능
    //     }
    //   }),
    // })
  ],
  controllers: [MovieController],
  providers: [MovieService],
})
export class MovieModule {}
