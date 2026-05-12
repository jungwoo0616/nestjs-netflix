import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";

@Injectable() 
export class MovieTitleValidationPipe implements PipeTransform<string, string> {
    transform(value: string, metadata: ArgumentMetadata): string {
        // 만약에 글자 길이가 2보다 작거나 같으면 에러 던지기!
        
        if(!value){
            return value;
        }

        if(value.length <= 2){
            throw new BadRequestException('영화의 제목은 3자 이상 작성해주세요!');
        }

        return value;
    }
}

// 파이프를 만들 때는 
// 무조건 @Injectable() 작성!!!
// PipeTransform을 무조건 implements 해야 함!!
// transform 을 무조건 overriding 해야 함!!