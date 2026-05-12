import { ApiHideProperty } from "@nestjs/swagger";
import { Exclude } from "class-transformer";
import { CreateDateColumn, UpdateDateColumn, VersionColumn } from "typeorm";

export class BaseTable {
    @CreateDateColumn()
    @Exclude() // 어차피 응답으로 안보여줄거니까
    @ApiHideProperty() // 스웨거에서도 숨기기
    createdAt!: Date;

    @UpdateDateColumn()
    @Exclude()
    @ApiHideProperty()
    updatedAt!: Date;

    @VersionColumn()
    @Exclude()
    @ApiHideProperty()
    version!: number;
}