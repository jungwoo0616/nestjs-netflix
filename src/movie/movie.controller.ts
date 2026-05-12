import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, ClassSerializerInterceptor, ParseIntPipe, BadRequestException, UseGuards, UploadedFile, UploadedFiles, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { MovieService } from './movie.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Public } from 'src/auth/decorator/public.decorator';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { Role } from 'src/user/entities/user.entity';
import { GetMoviesDto } from 'src/movie/dto/get-movies.dto';
import { TransactionInterceptor } from 'src/common/interceptor/transaction.interceptor';
import { UserId } from 'src/user/decorator/user-id.decorator';
import { QueryRunner } from 'src/common/decorator/query-runner.decorator';
import type { QueryRunner as QR } from 'typeorm'
import { CacheKey, CacheTTL, CacheInterceptor as CI } from '@nestjs/cache-manager';
import { Throttle } from 'src/common/decorator/throttle.decorator';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller('movie')
@ApiBearerAuth()
@ApiTags('movie') // 엔드포인트들을 그룹으로 정리하는 것. 강사가 강의 찍을 때는 Default라고 나와있어서 이렇게 했는데 난 잘 나옴..
@UseInterceptors(ClassSerializerInterceptor)
export class MovieController {
  constructor(private readonly movieService: MovieService) {}

  @Get()
  @Public()
  //@UseInterceptors(CacheInterceptor) // -> 이건 우리가 직접 작성한 CacheInterceptor
  @Throttle({
    count: 5,
    unit: 'minute',
  }) 
  @ApiOperation({
    description: '[Movie]를 Pagination 하는 API', // api 엔드포인트의 설명을 넣을 수 있음
  })
  @ApiResponse({ // 응답 설명 추가 가능. 이건 무한히 추가 가능
    status: 200,
    description: '성공적으로 API Pagination을 실행 했을 때!'
  })
  @ApiResponse({ 
    status: 400,
    description: 'Pagination 데이터를 잘못 입력했을 때'
  })
  getMovies(
    @Query() dto: GetMoviesDto,
    @UserId() userId?: number,
  ){
    return this.movieService.findAll(dto, userId);
  }

  // 캐싱  /movie/recent -> @Get(':id')위에 넣어야 안걸림
  @Get('recent')
  @UseInterceptors(CI) // 이걸 사용하면 자동으로 이 엔드포인트의 결과를 캐싱해버림(/movie/recent가 키가 됨)
                       // 그런데 쿼리 파라미터를 넣으면 url이 달라져서 키값이 달라지므로 서로 다른 캐시가 됨
                       // 즉, 우리가 필터링한 형태에 따라서 따로 캐싱 가능
  @CacheKey('getMoviesRecent') // 원한다면 이걸로 캐시 키값 변경 가능 -> 이러면 쿼리가 변경되도 같은 키에 저장됨
  @CacheTTL(1000) // TTL 변경도 가능
  @Throttle({
    count: 5,
    unit: 'minute',
  }) 
  getMoviesRecent(){
    //console.log('getMoviesRecent() 실행!');
    return this.movieService.findRecent();
  }

  @Get(':id')
  @Public()
  getMovie(
    // @Param('id', new ParseIntPipe({
    //   exceptionFactory(error){
    //     throw new BadRequestException('숫자를 입력해주세요!')
    //   }
    // })) id: number
    @Param('id', ParseIntPipe) id: number
  ){
    return this.movieService.findOne(id);
  }

  @Post()
  @RBAC(Role.admin)
  @UseInterceptors(TransactionInterceptor)
  postMovie(
    @Body() body: CreateMovieDto,
    @QueryRunner() queryRunner: QR,
    @UserId() userId: number,
  ){
    return this.movieService.create(
      body,
      userId,
      queryRunner,
    );
  }

  @Patch(':id')
  @RBAC(Role.admin)
  patchMovie(
    @Param('id', ParseIntPipe) id: number,
  @Body() body: UpdateMovieDto,
  ){
    return this.movieService.update(
      id,
      body,
    );
  }

  @Delete(':id')
  @RBAC(Role.admin)
  deleteMovie(
    @Param('id', ParseIntPipe) id: number,
  ){
    return this.movieService.remove(
      id,
    );
  }

  /**
   * [Like]  [Dislike]
   * 
   * 아무것도 누르지 않은 상태
   * Like & Dislike 모두 버튼 꺼져있음
   * 
   * Like 버튼 누르면/다시누르면
   * Like 버튼 불 켜짐/꺼짐
   * 
   * Dislike 버튼 누르면/다시누르면
   * Dislike 버튼 불 켜짐/꺼짐
   * 
   * Like 버튼 불 켜져있는데 Dislike 버튼 누름
   * Like 버튼 불 꺼지고 Dislike 버튼 불 켜짐
   */
  @Post(':id/like')
  createMovieLike(
    @Param('id', ParseIntPipe) movieId: number,
    @UserId() userId: number,
  ){
    return this.movieService.toggleMovieLike(movieId, userId, true);
  }

  @Post(':id/dislike')
  createMovieDislike(
    @Param('id', ParseIntPipe) movieId: number,
    @UserId() userId: number,
  ){
    return this.movieService.toggleMovieLike(movieId, userId, false);
  }


}
