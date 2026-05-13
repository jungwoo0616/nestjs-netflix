import { IsDateString, IsNotEmpty, IsString } from "class-validator";

export class CreateDirectorDto {
    @IsNotEmpty()
    @IsString()
    name!: string;

    @IsNotEmpty()
    @IsDateString()
    dob!: string;

    @IsNotEmpty()
    @IsString()
    nationality!: string;
}
