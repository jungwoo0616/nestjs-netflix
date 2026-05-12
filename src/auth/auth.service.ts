import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role, User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { envVariableKeys } from 'src/common/const/env.const';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly userService: UserService,
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
    ){}

    // 이상한 토큰 요청 블락
    async tokenBlock(token: string){
        const payload = this.jwtService.decode(token);

        // payload['exp'] -> epoch time seconds(1070년부터 초 단위로 센 값이 들어있음)
        const expiryDate = + new Date(payload['exp'] * 1000); // ms로 제공해야 하므로 1000을 곱함
        const now = + Date.now();

        const differenceInSeconds = (expiryDate - now) / 1000; // 초 단위로 변환(/1000)

        await this.cacheManager.set(`BLOCK_TOKEN_${token}`, payload, 
            Math.max(differenceInSeconds * 1000, 1) 
        )

        return true;
    }

    parseBasicToken(rawToken: string){
        // 1) 토큰을 ' ' 기준으로 스플릿 한 후 토큰 값만 추출하기
        // ['basic', $token]
        const basicSplit = rawToken.split(' ');

        if(basicSplit.length !== 2){
            throw new BadRequestException('토큰 포맷이 잘못됐습니다!');
        }

        const [basic, token] = basicSplit;

        if(basic.toLowerCase() !== 'basic'){
            throw new BadRequestException('토큰 포맷이 잘못됐습니다!');
        }

        // 2) 추출한 토큰을 base64 디코딩해서 이메일과 비밀번호로 나눈다.
        const decoded = Buffer.from (token, 'base64').toString('utf-8');

        // "email:password"
        // [email, password]
        const tokenSplit = decoded.split(':');

        if(tokenSplit.length !== 2){
            throw new BadRequestException('토큰 포맷이 잘못됐습니다!');
        }

        const [email, password] = tokenSplit;

        return {
            email,
            password,
        }
    }

    async parseBearerToken(rawToken: string, isRefreshToken: boolean){
        const basicSplit = rawToken.split(' ');

        if(basicSplit.length !== 2){
            throw new BadRequestException('토큰 포맷이 잘못됐습니다!');
        }

        const [bearer, token] = basicSplit;

        if(bearer.toLowerCase() !== 'bearer'){
            throw new BadRequestException('토큰 포맷이 잘못됐습니다!');
        }

        try{
            // verifyAsync() - payload 가져옴 + 검증
            const  payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.get<string>(
                    isRefreshToken ? envVariableKeys.refreshTokenSecret : envVariableKeys.accessTokenSecret
                ),
            });

            if(isRefreshToken){
                if(payload.type !== 'refresh'){
                    throw new BadRequestException('Refresh 토큰을 입력해주세요!');
                }
            }else{
                if(payload.type !== 'access'){
                    throw new BadRequestException('Access 토큰을 입력해주세요!');
                }
            }

            return payload;
        }catch(e){
            throw new UnauthorizedException('토큰이 만료됐습니다!')
        }
    }

    // rawToken -> "Basic $token"
    async register(rawToken: string){
        const {email, password} = this.parseBasicToken(rawToken);

        return this.userService.create({
            email,
            password,
        })
    }

    async authenticate(email: string, password: string){
        const user = await this.userRepository.findOne({
            where: {
                email,
            }
        });

        if(!user){
            throw new BadRequestException('잘못된 로그인 정보입니다!');
        }

        // 여기서 password는 암호화 안된 상태 -> 암호화헤서 user.password와 비교
        const passOk = await bcrypt.compare(password, user.password);

        if(!passOk){
            throw new BadRequestException('잘못된 로그인 정보입니다!');
        }

        return user;
    }

    async issueToken(user: {id: number, role: Role}, isRefreshToken: boolean){
        const refreshTokenSecret = this.configService.get<string>(envVariableKeys.refreshTokenSecret);
        const accessTokenSecret = this.configService.get<string>(envVariableKeys.accessTokenSecret);

        return this.jwtService.signAsync({
            sub: user.id,
            role: user.role,
            type: isRefreshToken ? 'refresh' : 'access',
        }, {
            secret: isRefreshToken? refreshTokenSecret : accessTokenSecret,
            expiresIn: isRefreshToken ? '24h' : 600, 
        })
    }

    async login(rawToken: string){
        const {email, password} = this.parseBasicToken(rawToken);

        const user = await this.authenticate(email, password);

        return {
            refreshToken: await this.issueToken(user, true),
            accessToken: await this.issueToken(user, false),
        }

        // const refreshTokenSecret = this.configService.get<string>('REFRESH_TOKEN_SECRET');
        // const accessTokenSecret = this.configService.get<string>('ACCESS_TOKEN_SECRET');

        // return {
        //     refreshToken: await this.jwtService.signAsync({
        //         sub: user.id,
        //         role: user.role,
        //         type: 'refresh',
        //     }, {
        //         // JwtModule.register({})에서 넣어주지 않았던 옵션을 여기서 넣음
        //         secret: refreshTokenSecret,
        //         expiresIn: '24h', // 24시간(이건 원하는대로 적어도 됨)
        //     }),
        //     accessToken: await this.jwtService.signAsync({
        //         sub: user.id,
        //         role: user.role,
        //         type: 'access',
        //     }, {
        //         secret: accessTokenSecret,
        //         expiresIn: 300, // 300초(5분) (이건 원하는대로 적어도 됨)
        //     }), 
        // }
    }
}
