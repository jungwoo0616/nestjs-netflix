import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { CursorPaginationDto } from "src/common/dto/cursor-pagination.dto";
import { PagePaginationDto } from "src/common/dto/page-pagination.dto";

export class GetMoviesDto extends CursorPaginationDto {
    @IsString()
    @IsOptional()
    @ApiProperty({
        description: '영화의 제목', // 설명
        example: '프로메테우스', // 예제
    })
    title?: string;
}