import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('common')
@ApiBearerAuth()
export class CommonController {
    @Post('video')
    @UseInterceptors(FileInterceptor('video', {
    limits: { // limits에 걸리면 파일이 아예 저장되지 않음
        fileSize: 20000000,
    },
    fileFilter(req, file, callback){
        if(file.mimetype !== 'video/mp4'){
        return callback(new BadRequestException('MP4 타입만 업로드 가능합니다!'), false)
        }
        return callback(null, true); // callback(던질 에러, 파일 저장할지)
    }
    }))
    createVideo(
        @UploadedFile() movie: Express.Multer.File,
    ){
        return {
            fileName: movie.filename,
        }
    }
} 
