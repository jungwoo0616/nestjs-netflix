import { PartialType } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, registerDecorator, Validate, ValidationArguments, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";
import { CreateMovieDto } from "./create-movie.dto";

export class UpdateMovieDto extends PartialType(CreateMovieDto){}

// PartialType을
// import { PartialType } from "@nestjs/mapped-types"; 이거말고 
// import { PartialType } from "@nestjs/swagger"; 여기에서 불러오면
// 스웨거에서 인지 가능. (PartialType은 완전히 똑같은 기능)
// 모두다 이렇게 해줄 필요는 없고 프론트엔드 쪽에서 이해하기 어려울 듯한.. 예시가 필요해 보이는 것들만 해도 됨
// 강사는 이렇게 하는 편이나 프로젝트 팀에서 정한대로 하는 것이 정석