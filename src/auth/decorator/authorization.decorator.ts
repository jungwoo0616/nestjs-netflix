import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const Authorization = createParamDecorator(
    (data: any, context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest();

        return req.headers['authorization'];
    }
)

// 이거 사용하면 스웨거의 /auth/login에 파라미터가 필요없다고 나옴. 
// 이건 우리가 커스터마이즈한거라 자동으로 스웨거 플러그인에서 인식하지 못하기 때문
// 꿀팁 - 스웨거 플러그인에서 인식하지 못하게 하고 싶으면 이런 식으로 직접 만들면 됨