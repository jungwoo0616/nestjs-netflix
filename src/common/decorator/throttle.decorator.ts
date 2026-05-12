import { Reflector } from "@nestjs/core";

export const Throttle = Reflector.createDecorator<{
    count: number,
    unit: 'minute' // 분/시간/일 마다 적용할지(우리는 분 마다 적용하는 걸로 하자)
}>();