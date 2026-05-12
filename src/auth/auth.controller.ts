import { Controller, Post, Headers, Request, UseGuards, Get, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { LocalAuthGuard } from './strategy/local.strategy';
import { JwtAuthGuard } from './strategy/jwt.strategy';
import { Public } from './decorator/public.decorator';
import { ApiBasicAuth, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Authorization } from './decorator/authorization.decorator';

@Controller('auth')
@ApiBearerAuth() // 모든 컨트롤러에 이거 달아주기
@ApiTags('auth') // 엔드포인트들을 그룹으로 정리하는 것. 강사가 강의 찍을 때는 Default라고 나와있어서 이렇게 했는데 난 잘 나옴..
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @ApiBasicAuth()
  @Post('register')
  // authorization: Basic $token
  registerUser(@Authorization() token: string){
    return this.authService.register(token);
  }

  @Public()
  @ApiBasicAuth() // 이거 추가(이거 넣으면 http://localhost:3000/doc에서 토큰 인증이 필요한 곳에 자물쇠 모양이 보임)
  @Post('login')
  // authorization: Basic $token
  loginUser(@Authorization() token: string){
    return this.authService.login(token);
  }

  @Post('token/block')
  blockToken(
    @Body('token') token: string,
  ){
    return this.authService.tokenBlock(token);
  }

  @Post('token/access')
  async rotateAccessToken(@Request() req: any){
    return {
      accessToken: await this.authService.issueToken(req.user, false),
    }
  }

  // @UseGuards(AuthGuard('local'))
  @UseGuards(LocalAuthGuard) // 위의 코드처럼 스트링을 입력했을 때 실수 방지 가능
  @Post('login/passport')
  async loginUserPassport(@Request() req){
    // return req.user; 
    // req에 user가 어떻게 붙었냐? 
    // -> 이건 그냥 LocalStrategy에서 그렇게 되도록 구현이 되있음(신경 ㄴㄴ)

    return {
      refreshToken: await this.authService.issueToken(req.user, true),
      accessToken: await this.authService.issueToken(req.user, false),
    }
  }

  // // 토큰을 기반으로 지금 사용자가 어떤 사용자고 어떤 권한을 갖고 있는지
  // @UseGuards(JwtAuthGuard)
  // @Get('private')
  // async private(@Request() req){
  //   return req.user; // JwtStrategy의 validate()에서 반환한 값을 req.user로 받을 수 있음
  // }

}
