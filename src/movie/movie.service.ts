import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { Movie } from './entity/movie.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';
import { MovieDetail } from './entity/movie-detail.entity';
import { Director } from 'src/director/entity/director.entity';
import { Genre } from 'src/genre/entity/genre.entity';
import { GetMoviesDto } from 'src/movie/dto/get-movies.dto';
import { CommonService } from 'src/common/common.service';
import { join } from 'path';
import { rename } from 'fs/promises';
import { User } from 'src/user/entities/user.entity';
import { MovieUserLike } from './entity/movie-user-like.entity';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class MovieService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(MovieDetail)
    private readonly movieDetailRepository: Repository<MovieDetail>,
    @InjectRepository(Director)
    private readonly directorRepository: Repository<Director>,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MovieUserLike)
    private readonly movieUserLikeRepository: Repository<MovieUserLike>,
    private readonly dataSource: DataSource, // 트랜잭션을 위해 추가
    private readonly commonService: CommonService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ){}
  // 캐싱 적용 함수
  async findRecent(){
    // 사용 예시
    // await this.cacheManager.set('number', 10); // 캐시 저장하기. set(캐시를 저장할 키값, 어떤 값 저장할지)

    // const data = await this.cacheManager.get('number') // 캐시 가져오기

    // console.log(data);

    const cacheData = await this.cacheManager.get('MOVIE_RECENT');

    // 캐시가 존재하면 그 데이터를 바로 반환(당연히 서버가 재시작되면 캐시 없어짐. 서버 실행 도중에만 캐시 존재 가능)
    if(cacheData){
      // console.log('cache 가져옴');
      return cacheData;
    }

    // 캐시가 존재하지 않으면 캐시에 저장 후 data 반환
    const data = await this.movieRepository.find({
      order: {
        createdAt: 'DESC',
      },
      take: 10
    })

    await this.cacheManager.set('MOVIE_RECENT', data); 
    // set('MOVIE_RECENT', data, 0); 
    // 0은 TTL(Time To LIVE, 캐시를 몇초동안 저장하고 있을지)
    // 0이면 무한히 저장(3000이면 3000ms(3초)동안 만 저장 후 삭제)
    // module.ts에서 기본값 지정해도 이렇게 여기서 TTL 덮어쓰기 가능

    // 캐시 단점 - 데이터가 새로 갱신되면 캐시 만료 전까지는 그 데이터 못가져옴.. -> 이걸 고려해서 캐시 유지 기간 설정 바람

    return data;
  }

  // 이렇게 복잡한 쿼리 빌더를 따로 함수로 만들고 이름을 잘 지어 놓으면 이 쿼리빌더가
  // 어떤 역할을 하는 지 쉽게 파악 가능
  // 이 함수를 단위 테스트 하는 건 의미X -> 이건 typeORM 안에서 테스트 하는 것!
  // istanbul ignore next 라고 함수 위에 주석으로 써놓기도 함(테스트 커버리지에 들어가지 않는다는 의미)
  /* istanbul ignore next */
  async getMovies(){
    return await this.movieRepository.createQueryBuilder('movie') // 'movie'는 movie 테이블의 alias(별칭)
      .leftJoinAndSelect('movie.director', 'director') // movie.director를 leftjoin할거고 alias는 director로 할 것임
      .leftJoinAndSelect('movie.genres', 'genres');
  }

  /* istanbul ignore next */
  async getLikedMovies(movieIds: number[], userId: number){
    return this.movieUserLikeRepository.createQueryBuilder('mul')
        .leftJoinAndSelect('mul.user', 'user')
        .leftJoinAndSelect('mul.movie', 'movie')
        .where('movie.id IN(:...movieIds)', {movieIds}) // ... -> movieIds 리스트의 값들이 ,로 나눠져서 들어감
        .andWhere('user.id = :userId', {userId})
        .getMany();
  }

  async findAll(dto: GetMoviesDto, userId?: number){
    //const {title, take, page} = dto;
    const {title} = dto;

    const qb = await this.getMovies();

    if(title){
      qb.where('movie.title LIKE :title', {title: `%${title}%`}); // :이 붙으면 변수
    }

    // 페이지 기반 페이지네이션
    // if(take && page) {
    //   this.commonService.applyPagePaginationParamsToQb(qb, dto);
    // }

    const {nextCursor} = await this.commonService.applyCursorPaginationParamsToQb(qb, dto);

    let [data, count] = await qb.getManyAndCount(); // 여러개의 데이터를 위의 쿼리대로 가져옴

    if(userId){
      const movieIds = data.map(movie => movie.id); // 조회된 영화의 id만 뽑기 -> [1, 2, 10, 13, ...]

      const likedMovies = movieIds.length < 1 ? [] : await this.getLikedMovies(movieIds, userId);
      
      /**
       * {
       *  key: value가 
       *  movieId: boolean 되도록 만들 것임
       * }
       * 
       * likedMovieMap 예시 
       * {
       *  1: true,
       *  3: false
       * }
       */
      const likedMovieMap = likedMovies.reduce((acc, next) => ({
        ...acc,
        [next.movie.id]: next.isLike,
      }), {});

      data = data.map((x)=>({
        ...x,
        // null || true || false
        likeStatus: x.id in likedMovieMap ? likedMovieMap[x.id] : null 
      }))
    }

    return { 
      data,
      nextCursor,
      count,
    }; 

  }

  /* istanbul ignore next */
  async findMovieDetail(id: number){
    return this.movieRepository.createQueryBuilder('movie') 
      .leftJoinAndSelect('movie.director', 'director') 
      .leftJoinAndSelect('movie.genres', 'genres')
      .leftJoinAndSelect('movie.detail', 'detail')
      .leftJoinAndSelect('movie.creator', 'creator')
      .where('movie.id = :id', {id})
      .getOne(); // 하나만 가져와라
  }

  async findOne(id: number){
    const movie = await this.findMovieDetail(id);

    // const movie = await this.movieRepository.findOne({
    //   where: {
    //     id,
    //   },
    //   relations: ['director', 'genres'],
    // });

    if(!movie){
      throw new NotFoundException('존재하지 않는 ID의 영화입니다!');
    }

    return movie;
  }

  /* istanbul ignore next */
  async createMovieDetail(qr: QueryRunner, createMovieDto: CreateMovieDto){
    return qr.manager.createQueryBuilder() // 여기에는 따로 레포지토리 명시 필요 없음
      .insert()
      .into(MovieDetail) // 어차피 여기에 문맥(테이블)을 넣어주기 때문
      .values({
        detail: createMovieDto.detail,
      })
      .execute() // 이렇게 실행을 해야 적용됨
  }

  /* istanbul ignore next */
  async createMovie(qr: QueryRunner, createMovieDto: CreateMovieDto, director: Director, movieDetailId: number, userId: number, movieFolder: string){
    return qr.manager.createQueryBuilder()
      .insert()
      .into(Movie)
      .values({
        title: createMovieDto.title,
        detail: {
          id: movieDetailId, // 이렇게 연결을 시켜줘야 함(동시 생성 불가 -> 쿼리 빌더의 단점...)
        },
        director,// OneToMany관계는 동시 생성 가능
        // genres, // ManyToMany 관계도 동시에 생성 불가
        creator: {
          id: userId,
        },
        movieFilePath: join(movieFolder, createMovieDto.movieFileName),
      })
      .execute()
  }

  /* istanbul ignore next */
  async createMovieGenreRelation(qr: QueryRunner, movieId: number, genres: Genre[]){
    return qr.manager.createQueryBuilder()
      .relation(Movie, 'genres') // Movie테이블에서 genres와의 관계를 조작할 것임
      .of(movieId) // 그러면 Movie테이블의 어떤 ID값을 조작? -> 우리가 생성한 movieId에 해당되는 값을 조작할 것임
      .add(genres.map(genre => genre.id)); // 뭘 조작할거냐? -> genre관계를 추가할거다 -> genre의 ID값을 넣어줌
  }

  /* istanbul ignore next */
  renameMovieFile(tempFolder: string, movieFolder: string, createMovieDto: CreateMovieDto){
    return rename(
      join(process.cwd(), tempFolder, createMovieDto.movieFileName), // 여기에서
      join(process.cwd(), movieFolder, createMovieDto.movieFileName) // 여기로
    )
  }

  async create(createMovieDto: CreateMovieDto, userId: number,  qr: QueryRunner){
    // const qr = this.dataSource.createQueryRunner();
    // await qr.connect();
    // await qr.startTransaction();

    // try{
    const director = await qr.manager.findOne(Director, {
      where: {
        id: createMovieDto.directorId,
      },
    });

    if(!director){
      throw new NotFoundException('존재하지 않는 ID의 감독입니다!');
    }

    const genres = await qr.manager.find(Genre, {
      where: {
        id: In(createMovieDto.genreIds),
      },
    });

    if(genres.length !== createMovieDto.genreIds.length){
      throw new NotFoundException(`존재하지 않는 장르가 있습니다! 존재하지 않는 ids -> ${genres.map(genre => genre.id).join(',')}`);
    }

    // save는 레포지토리 패턴으로 하는 것이 훨씬 편함
    // save를 할 때는 여러 정보가 한번에 다 조합됨 -> 쿼리빌터에서는 이게 안됨..(쿼리빌터로 하면 너무 복잡..)
    const movieDetail = await this.createMovieDetail(qr, createMovieDto);

    // throw new NotFoundException('일부러 에러 던짐'); // 트랜잭션 테스트용 에러 던지기

    const movieDetailId = movieDetail.identifiers[0].id // insert한 값들의 ID를 리스트로 받을 수 있음. 우리는 values에 값을 하나만 넣었으므로 [0]를 하면 생성한 값의 ID를 가져올 수 있음

    const movieFolder = join('public', 'movie');
    const tempFolder = join('public', 'temp');


    const movie = await this.createMovie(qr, createMovieDto, director, movieDetailId, userId, movieFolder);

    const movieId = movie.identifiers[0].id

    await this.createMovieGenreRelation(qr, movieId, genres);

    // await qr.commitTransaction();

    // video파일 경로 변경(파일을 옮김)
    // 트랜잭션 기능이 실행되고 나서 변경 작업 진행
    await this.renameMovieFile(tempFolder, movieFolder, createMovieDto);

    // 인터셉터로 트랜젝션 적용 시 모든 코드가 진행된 후에 커밋이 완료됨
    // 그냥 일반 레포지토리에서 find를 하면 아직 커밋되기 전이라 아무것도 출력이 안됨
    // 즉, 원본 DB에 아직 적용이 안된 상태
    // 그래서 아래와 같이 해야함.
    return await qr.manager.findOne(Movie, { // 이미 커밋된 상태이므로 qr.manager 필요없음
      where: {
        id: movieId,
      },
      relations: ['detail', 'director', 'genres'],
    });

    // return await this.movieRepository.findOne({ // 이미 커밋된 상태이므로 qr.manager 필요없음
    //   where: {
    //     id: movieId,
    //   },
    //   relations: ['detail', 'director', 'genres'],
    // });
    // }catch(e){
    //   await qr.rollbackTransaction();  
    
    //   throw e;
    // }finally{
    //   await qr.release();
    // }
  }

  /* istanbul ignore next */
  async updateMovie(qr: QueryRunner, movieUpdateFields: UpdateMovieDto, id: number){
    return qr.manager.createQueryBuilder()
        .update(Movie)
        .set(movieUpdateFields) 
        .where('id = :id', {id})
        .execute();
  }

  /* istanbul ignore next */
  async updateMovieDetail(qr: QueryRunner, detail: string, movie: Movie){
    return qr.manager.createQueryBuilder()
          .update(MovieDetail)
          .set({
            detail,
          })
          .where('id  = :id', {id: movie.detail.id})
          .execute();
  }

  /* istanbul ignore next */
  async updateMovieGenreRelation(qr: QueryRunner, id: number, newGenres: Genre[], movie: Movie){
    return qr.manager.createQueryBuilder()
          .relation(Movie, 'genres')
          .of(id)
          .addAndRemove(newGenres.map(genre => genre.id), movie.genres.map(genre => genre.id)) // 추가 + 삭제 동시에 진행, 1st파라미터: 추가할 관계(id), 2nd파라미터: 삭제할 관계(id)
  }

  async update(id: number, updateMovieDto: UpdateMovieDto){
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try{
      const movie = await qr.manager.findOne(Movie, {
        where: {
          id,
        },
        relations: ['detail', 'genres'],
      });

      if(!movie){
        throw new NotFoundException('존재하지 않는 ID의 영화입니다!');
      }

      const {detail, directorId, genreIds, ...movieRest} = updateMovieDto;

      let newDirector;

      if(directorId){
        const director = await qr.manager.findOne(Director, {
          where: {
            id: directorId,
          },
        });

        if(!director){
          throw new NotFoundException('존재하지 않는 ID의 감독입니다!');
        }

        newDirector = director;
      }

      let newGenres;

      if(genreIds){
        const genres = await qr.manager.find(Genre, {
          where: {
            id: In(genreIds),
          },
        });

        if(genres.length !== updateMovieDto.genreIds!.length){
          throw new NotFoundException(`존재하지 않는 장르가 있습니다! 존재하지 않는 ids -> ${genres.map(genre => genre.id).join(',')}`);
        }

        newGenres = genres
      }

      const movieUpdateFields = {
        ...movieRest,
        ... (newDirector && {director: newDirector})
      }

      await this.updateMovie(qr, movieUpdateFields, id);

      //throw new NotFoundException('에러 일부러 던짐');
      
      // await this.movieRepository.update(
      //   {id},
      //   movieUpdateFields,
      // )

      if(detail){
        await this.updateMovieDetail(qr, detail, movie)

        // await this.movieDetailRepository.update(
        //   {
        //     id: movie.detail.id,
        //   },
        //   {
        //     detail,
        //   }
        // )
      }

      if(newGenres){
        await this.updateMovieGenreRelation(qr, id, newGenres, movie);
      }

      // const newMovie = await this.movieRepository.findOne({
      //   where: {
      //     id,
      //   },
      //   relations: ['detail', 'director'],
      // })

      // newMovie!.genres = newGenres;

      // await this.movieRepository.save(newMovie!);
      await qr.commitTransaction();

      return this.movieRepository.findOne({
        where: {
          id,
        },
        relations: ['detail', 'director', 'genres'],
      });
    }catch(e){
      await qr.rollbackTransaction();

      throw e
    }finally{
      await qr.release();
    }
  }

  /* istanbul ignore next */
  async deleteMovie(id: number){
    return this.movieRepository.createQueryBuilder()
      .delete()
      .where('id = :id', {id})
      .execute();
  }

  async remove(id: number){
    const movie = await this.movieRepository.findOne({
      where: {
        id,
      },
      relations: ['detail'],
    });

    if(!movie){
      throw new NotFoundException('존재하지 않는 ID의 영화입니다!');
    }

    await this.deleteMovie(id);

    await this.movieRepository.delete(id);
    await this.movieDetailRepository.delete(movie.detail.id);

    return id;
  }

  /* istanbul ignore next */
  async getLikedRecord(movieId: number, userId: number){
    return this.movieUserLikeRepository.createQueryBuilder('mul')
      .leftJoinAndSelect('mul.movie', 'movie')
      .leftJoinAndSelect('mul.user', 'user')
      .where('movie.id = :movieId', {movieId})
      .andWhere('user.id = :userId', {userId})
      .getOne();

  }

  async toggleMovieLike(movieId: number, userId: number, isLike: boolean){
    const movie = await this.movieRepository.findOne({
      where: {
        id: movieId,
      }
    });

    if(!movie){
      throw new BadRequestException('존재하지 않는 영화입니다!');
    }

    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      }
    })

    if(!user){
      throw new UnauthorizedException('사용자 정보가 없습니다');
    }

    const likeRecord = await this.getLikedRecord(movieId, userId);

    if(likeRecord){
      if(isLike === likeRecord.isLike){ // like였는데 그냥 like버튼 눌러서 좋아요 취소(혹은 그 반대)
        await this.movieUserLikeRepository.delete({
          movie,
          user,
        });
      }else{ // like였는데 사용자가 dislike 눌렀을 경우(혹은 그 반대)
        await this.movieUserLikeRepository.update({
          movie,
          user,
        }, {
          isLike,
        })
      }
    }else{ // 애초에 데이터가 없었다면 새로 생성
      await this.movieUserLikeRepository.save({
        movie,
        user,
        isLike,
      })
    }

    const result = await this.getLikedRecord(movieId, userId);

    return {
      isLike: result && result.isLike,
      // result가 존재X -> null 반환. 존재하면 result.isLike 반환
    } 

  }

}

