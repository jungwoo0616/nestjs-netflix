import { Module } from "@nestjs/common";
import { CommonService } from "./common.service";
import { CommonController } from "./common.controller";
import { v4 } from "uuid";
import { MulterModule } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { join } from "path";
import { TasksService } from "./tasks.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Movie } from "src/movie/entity/movie.entity";
import { DefaultLogger } from "./logger/default.logger";


@Module({
    imports: [
        MulterModule.register({
            storage: diskStorage({
                // 파일 저장 위치
                destination: join(process.cwd(), 'public', 'temp'),
                filename: (req, file, cb) => {
                const split = file.originalname.split('.');

                let extension = 'mp4';

                if(split.length > 1){
                    extension = split[split.length-1];
                }
        
                cb(null, `${v4()}_${Date.now()}.${extension}`); // 두번째 파라미터에 원하는 파일명 입력
                // Date.now()로 언제 이 파일이 업로드 됬는지 확인 가능
                }
            }),
        }),
        TypeOrmModule.forFeature([
            Movie,
        ]),
    ],
    controllers: [CommonController],
    providers: [CommonService, TasksService, DefaultLogger],
    exports: [CommonService, DefaultLogger],
})
export class CommonModule{}
