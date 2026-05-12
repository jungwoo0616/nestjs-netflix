import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateMovieDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty({
        description: '영화 제목',
        example: '다크나이트', 
    })
    title!: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty({
        description: '영화 설명',
        example: '꿀잼', 
    })
    detail!: string;

    @IsNotEmpty()
    @IsNumber()
    @ApiProperty({
        description: '감독 객체 ID',
        example: 1, 
    })
    directorId!: number;

    @IsArray()
    @ArrayNotEmpty()
    @IsNumber({}, {
        each: true,
    })
    @Type(() => Number) // Number 타입으로 자동 transform(Body의 form-data에서는 string으로 가져옴..)
    @ApiProperty({
        description: '장르 IDs',
        example: [1, 2, 3], 
    })
    genreIds!: number[]

    @IsString()
    @ApiProperty({
        description: '영화 파일 이름',
        example: 'aaa-bbb-ccc-ddd.jpg', 
    })
    movieFileName!: string;
}