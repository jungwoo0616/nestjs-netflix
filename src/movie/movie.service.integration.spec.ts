import { CacheModule, Cache, CACHE_MANAGER } from "@nestjs/cache-manager"
import { Test, TestingModule } from "@nestjs/testing"
import { TypeOrmModule } from "@nestjs/typeorm"
import { Movie } from "./entity/movie.entity"
import { MovieDetail } from "./entity/movie-detail.entity"
import { Director } from "src/director/entity/director.entity"
import { Genre } from "src/genre/entity/genre.entity"
import { User } from "src/user/entities/user.entity"
import { MovieUserLike } from "./entity/movie-user-like.entity"
import { MovieService } from "./movie.service"
import { CommonService } from "src/common/common.service"
import { DataSource } from "typeorm"
import { UpdateMovieDto } from "./dto/update-movie.dto"
import { NotFoundException } from "@nestjs/common"
import { CreateMovieDto } from "./dto/create-movie.dto"

describe('MovieService - Integration Test', () => {
    let service: MovieService;
    let cacheManager: Cache;
    let dataSource: DataSource;

    let users: User[];
    let directors: Director[];
    let movies: Movie[];
    let genres: Genre[];

    beforeAll(async ()=>{
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                // 실제 모듈들을 inject해줄 것임
                // 캐시 모듈처럼 app.module.ts에 글로벌하게 넣어준 것도 
                // movieService에 관련된 모듈만 따로 생성하려면 이렇게 직접 넣어줘야 함
                CacheModule.register(),
                TypeOrmModule.forRoot({
                    //엔드투엔드 테스트가 아니므로 실제 postgreSQL DB는 안씀
                    // 여기서는 typeORM 모듈 API가 우리가 작성한 모듈과 정상 작동하는지 확인할 것임
                    // 우리가 알고싶은건 typeORM 모듈과 우리가 만든 로직 간의 유닛과 유닛의 integration test
                    type: 'better-sqlite3', // 가벼운 형태의 DB(파일 시스템으로 데이터를 읽을 수 있음)
                    database: ':memory:', // 하드드라이브에 데이터 기억X. 그냥 메모리에서 DB 구축(테스트 최적화)
                    dropSchema: true, // 연결할 때마다 DB 스키마 드랍할 건지
                    entities: [
                        Movie,
                        MovieDetail,
                        Director,
                        Genre,
                        User,
                        MovieUserLike,
                    ],
                    synchronize: true,
                    logging: false,
                }),
                TypeOrmModule.forFeature([
                    Movie,
                    MovieDetail,
                    Director,
                    Genre,
                    User,
                    MovieUserLike,
                ]),
            ],
            providers: [MovieService, CommonService]
        }).compile(); // 이렇게 하면 실제 모듈을 그대로 컴파일 가능 + 실제 typeORM 사용 가능

        service =  module.get<MovieService>(MovieService);
        cacheManager =  module.get<Cache>(CACHE_MANAGER);
        dataSource =  module.get<DataSource>(DataSource);
    });

    it('should be defined', ()=>{
        expect(service).toBeDefined();
    })

    afterAll(async ()=>{
        await dataSource.destroy() // 모든 테스트가 실행된 후에는 메모리에서 DB 삭제
    });

    // 매 테스트마다 깨끗한 상태의 테이블에서 시딩된 데이터가 들어가있도록 만드는 것(취향 차이)
    // 테스트 시작할 때 이 데이터들을 각 레포지토리에 집어 넣고서 시작
    beforeEach(async ()=>{
        await cacheManager.clear(); // 캐시 데이터 리셋

        // 실제 타입ORM 데이터를 사용
        const movieRepository = dataSource.getRepository(Movie);
        const movieDetailRepository = dataSource.getRepository(MovieDetail);
        const userRepository = dataSource.getRepository(User);
        const directorRepository = dataSource.getRepository(Director);
        const genreRepository = dataSource.getRepository(Genre);

        // fake(mock, 시드) 데이터 만들기
        users = [1, 2].map( // 2개의 가짜 데이터를 만듬
            (x) => userRepository.create({
                id: x,
                email: `${x}@test.com`,
                password: `123123`,
            })
        );

        await userRepository.save(users); 

        directors = [1, 2].map(
            x => directorRepository.create({
                id: x,
                dob: new Date('1992-11-23'),
                nationality: 'South Korea',
                name: `Director Name ${x}`,
            })
        );

        await directorRepository.save(directors);

        genres = [1, 2].map(
            x => genreRepository.create({
                id: x, 
                name: `Genre ${x}`,
            })
        );

        await genreRepository.save(genres);

        movies = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(
            x => movieRepository.create({
                id: x,
                title: `Movie ${x}`,
                creator: users[0],
                genres: genres,
                likeCount: 0,
                dislikeCount: 0,
                detail: movieDetailRepository.create({
                    detail: `Movie Detail ${x}`,
                }),
                movieFilePath: 'movies/movie1.mp4',
                director: directors[0],
                createdAt: new Date(`2023-9-${x}`),
            })
        );

        await movieRepository.save(movies);
    });

    // 커버리지는 이미 유닛 테스트에서 올려놨으므로 통합, 엔드투엔드 테스트로 갈수록 흐름만 볼 것임
    // ex. findRecent() - 실제 최신 데이터 가져오는지, 캐싱이 되는지 기능적인 부분이 궁금 -> 여기에 집중

    describe('findRecent', () => {
        it('should return recent movies', async () => {
            const result = await service.findRecent() as Movie[]; // 그냥 바로 실행
            // 실제로 최신 데이터 가져옴 + 캐시 저장이 되야 함(실제 로직 및 typeORM을 실행했으니까)

            let sortedResult = [...movies]; 
            sortedResult.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // 최신순 정렬
            let sortedResultIds = sortedResult.slice(0, 10).map(x => x.id); // 우리가 진짜로 기대하는 값
            // 10개의 데이터만 가져오는 이유 - 실제 findRecent() 보면 take: 10 이라고 작성함

            expect(result).toHaveLength(10); // 길이 10을 기대
            expect(result.map(x => x.id)).toEqual(sortedResultIds);

            // 지금 보면 모킹 하나도 안함 -> 실제 typeORM을 사용했으니까!!!
        });

        // 캐시 모듈(기능) 테스트
        it('should cache recent movies', async () => {
            const result = await service.findRecent() as Movie[]; // 여기서 실행했으니까 캐싱됐을 것을 기대

            const cachedData = await cacheManager.get('MOVIE_RECENT');

            expect(cachedData).toEqual(result); // result를 캐시로 저장했으므로 서로 값이 같아야 함

            // 유닛 테스트보다 더 간결하고 직관적으로 이해쉽고 신뢰도도 높음. 
            // 그러나 유닛 테스트보다 테스트 시간이 더 오래걸림 -> 실제 DB를 쓰니까
            // 그나마 메모리에서 DB를 사용하니까 이정도.. 실제 postgerSQL을 사용했다면? -> 외부 요청으로 인해 더 오래걸림
        });
    });

    describe('findAll', () => {
        it('should return movies with correct titles', async () => {
            const dto = {
                title: 'Movie 15',
                order: ['createdAt_DESC'],
                take: 10,
            };

            const result = await service.findAll(dto);

            expect(result.data).toHaveLength(1); // title: 'Movie 15'는 하나 밖에 없음
            expect(result.data[0].title).toBe(dto.title);
            expect(result.data[0]).not.toHaveProperty('likeStatus');
        });

        it('should return likeStatus if userId is provided', async () => {
            const dto = { order: ['createdAt_ASC'], take: 10 };

            const result = await service.findAll(dto, users[0].id);

            expect(result.data).toHaveLength(10);
            expect(result.data[0]).toHaveProperty('likeStatus');
        });
    });

    describe('findOne', ()=>{
        it('should return movie correctly', async ()=>{
            const movieId = movies[0].id;

            const result = await service.findOne(movieId);

            expect(result.id).toBe(movieId);
        });

        it('should throw NotFoundException if movie does not exist', async ()=>{
            await expect(service.findOne(999999999999)).rejects.toThrow(NotFoundException);
        })
    })

    describe('create', () => {
        beforeEach(() => {
            // 영화 파일은 그냥 제대로 옮겨졌다고 가정 -> 그냥 모킹하자(시간 많이 걸림)
            jest.spyOn(service, 'renameMovieFile').mockResolvedValue();
        });

        it('should create movie correctly', async () => {
            const createMovieDto: CreateMovieDto = {
                title: 'Test Movie',
                detail: 'A Test Movie Detail',
                directorId: directors[0].id,
                genreIds: genres.map(x => x.id),
                movieFileName: 'test.mp4',
            };

            const result = await service.create(createMovieDto, users[0].id, dataSource.createQueryRunner()); 

            expect(result!.title).toBe(createMovieDto.title);
            expect(result!.director.id).toBe(createMovieDto.directorId);
            expect(result!.genres.map(g => g.id)).toEqual(genres.map(g => g.id));
            expect(result!.detail.detail).toBe(createMovieDto.detail);
        });
    });

    describe('update', () => {
        it('should update movie correctly', async () => {
            const movieId = movies[0].id;

            const updateMovieDto: UpdateMovieDto = {
                title: 'Changed Title',
                detail: 'Changed Detail',
                directorId: directors[1].id,
                genreIds: [genres[0].id],
            };

            const result = await service.update(movieId, updateMovieDto);

            expect(result!.title).toBe(updateMovieDto.title);
            expect(result!.detail.detail).toBe(updateMovieDto.detail);
            expect(result!.director.id).toBe(updateMovieDto.directorId);
            expect(result!.genres.map(x => x.id)).toEqual(updateMovieDto.genreIds);
        });

        it('should throw error if movie does not exist', async () => {
            const updateMovieDto: UpdateMovieDto = {
                title: 'Change',
            };

            await expect(service.update(9999999, updateMovieDto)).rejects.toThrow(NotFoundException);
        })
    });

    describe('remove', () => {
        it('should remove movie correctly', async () => {
            const removeId = movies[0].id;
            const result = await service.remove(removeId);

            expect(result).toBe(removeId);
        });

        it('should throw error if movie does not exist', async()=>{
            await expect(service.remove(999999)).rejects.toThrow(NotFoundException);
        })
    })

    describe('toggleMovieLike', ()=>{
        it('should create like correctly', async ()=>{
            const userId = users[0].id;
            const movieId = movies[0].id;

            const result = await service.toggleMovieLike(movieId, userId, true);

            expect(result).toEqual({isLike: true});
        });

        it('should create dislike correctly', async ()=>{
            const userId = users[0].id;
            const movieId = movies[0].id;

            const result = await service.toggleMovieLike(movieId, userId, false);

            expect(result).toEqual({isLike: false});
        });

        it('should toggle like correctly', async ()=>{
            const userId = users[0].id;
            const movieId = movies[0].id;

            await service.toggleMovieLike(movieId, userId, true);
            const result = await service.toggleMovieLike(movieId, userId, true);

            expect(result.isLike).toBeNull();
        });

        it('should toggle dislike correctly', async ()=>{
            const userId = users[0].id;
            const movieId = movies[0].id;

            await service.toggleMovieLike(movieId, userId, false);
            const result = await service.toggleMovieLike(movieId, userId, false);

            expect(result.isLike).toBeNull();
        });
    });
})