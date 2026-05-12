import { BadRequestException, Injectable } from "@nestjs/common";
import { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { PagePaginationDto } from "./dto/page-pagination.dto";
import { CursorPaginationDto } from "./dto/cursor-pagination.dto";


@Injectable()
export class CommonService {
    constructor(){}

    applyPagePaginationParamsToQb<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, dto: PagePaginationDto) {
        const {page, take} = dto;

        const skip = (page - 1) * take;

        qb.take(take);
        qb.skip(skip);
    }

    async applyCursorPaginationParamsToQb<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, dto: CursorPaginationDto) {
        let {cursor, order, take} = dto;

        // 프론트엔드에서 받은 커서를 가지고 다음 페이지 만들기
        if(cursor){
            const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');

            /**
             * 반환값 형태
             * {
             *  values: {
             *      id: 27 
             *  },
             *  order: ['id_DESC']
             * }
             */
            const cursorObj = JSON.parse(decodedCursor); // string으로 되어있는 json을 실제 json으로 변환

            order = cursorObj.order; // 덮어씀 -> 다음값은 이 cursor를 기반으로 요청 -> 프론트엔드에서 order에 값을 실수로 넣었을 때를 방지
            // 즉 dto의 order에 어떤 값이 입력되더라도 cursor의 order를 기반으로 다음 페이지 요청

            const {values} = cursorObj;


            // (column1, column2, column3) > (:value1, :value2, :value3) 이런 형태의 필터릥을 코드로 구현
            // 결국 이 쿼리가 만들어지도록 코드를 구현하면 됨.
            // postsql에서는 이 쿼리를 넣으면 컬럼 순서대로 정렬함
            const columns = Object.keys(values);

            const comparisionOperator = order.some((o)=>o.endsWith('DESC')) ? '<' : '>'; // DESC으로 끝나는 키가 존재하는지 확인
            const whereConditions = columns.map(c => `${qb.alias}.${c}`).join(',');
            const whereParams = columns.map(c => `:${c}`).join(',')

            qb.where(`(${whereConditions}) ${comparisionOperator} (${whereParams})`, values);
        }

        // ex. ["likeCount_DESC", "id_DESC"]
        for(let i = 0; i< order.length; i++){
            const [column, direction] = order[i].split('_');

            if(direction !== 'ASC' && direction !== 'DESC'){
                throw new BadRequestException('Order는 ASC 또는 DESC로 입력해주세요!');
            }

            if(i === 0){
                qb.orderBy(`${qb.alias}.${column}`, direction);
            }else{
                qb.addOrderBy(`${qb.alias}.${column}`, direction);
            }
        }

        // if(id){
        //     const direction = order === 'ASC' ? '>' : '<';

        //     // order가 ASC이면  movie.id > :id
        //     qb.where(`${qb.alias}.id ${direction} :id`, {id});
        // }

        // // id 기준 ASC 또는 DESC 기준으로 ordering을 하겠다
        // qb.orderBy(`${qb.alias}.id`, order) // alias - 선택한 테이블을 무엇으로 불렀는지(ex. movie 테이블 선택했다면 movie라고 나옴)

        qb.take(take);

        // 지금까지 빌드한 쿼리를 가져옴
        const results = await qb.getMany();

        const nextCursor = this.generateNextCursor(results, order);

        return {qb, nextCursor}; // qb는 써도 되고 안써도 되는데 그냥 반환했음
    }

    generateNextCursor<T>(results: T[], order: string[]): string | null {
        if(results.length === 0) return null; // 응답값이 없으면 다음 커서 없음

        /**
         * 반환값 형태
         * {
         *  values: {
         *      id: 27 
         *  },
         *  order: ['id_DESC']
         * }
         */

        const lastItem = results[results.length -1]; // 마지막 값
        
        const values = {}

        order.forEach((columnOrder) => {
            const [column] = columnOrder.split('_');
            values[column] = lastItem[column];
        });

        const cursorObj = {values, order};

        // cursorObj를 base64로 인코딩해서 보내주면 좋음
        // 프론트엔드에서는 인코딩된 스트링을 통채로 관리하다가 그대로 그 스트링을 쿼리에 넣어서 보내면 편함
        const nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64');

        return nextCursor;
    }
}
