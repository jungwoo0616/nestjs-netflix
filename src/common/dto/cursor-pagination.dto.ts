import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsString } from "class-validator";

export class CursorPaginationDto {
    @IsString()
    @IsOptional()
    @ApiProperty({
        description: '페이지네이션 커서', // 설명
        example: 'eyJ2YWx1ZXMiOnsiaWQiOjN9LCJvcmRlciI6WyJpZF9ERVNDIl19', // 예제
    })
    // 들어가는 데이터 예시
    // id_52, likeCount_20
    cursor?: string;

    @IsArray()
    @IsString({
        each: true,
    })
    @IsOptional()
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    @ApiProperty({
        description: '내림차 또는 오름차 정렬',
        example: ['id_DESC'],
    })
    // 들어가는 데이터 예시
    // [id_DESC, likeCount_DESC]
    order: string[] = ['id_DESC'];

    @IsInt()
    @IsOptional()
    @ApiProperty({
        description: '가져올 데이터 개수',
        example: 5,
    })
    take: number = 5;
}

// 우리가 할 커서 페이지네이션은 프론트엔드가 편하도록 구현 