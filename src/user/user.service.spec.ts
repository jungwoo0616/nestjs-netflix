import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import * as bcrypt from 'bcrypt';
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// 모킹 추가!!
// 실제 DB Repository 대신 사용할 가짜 객체
const mockUserRepository = {
  // 실제로 사용할 함수만 넣어주면 됨
  // jest.fn()은 Jest의 Mock 함수
  findOne: jest.fn(),
  save: jest.fn(),
  find: jest.fn(), // 같은 함수(find())가 호출되었는지 추적 가능
  update: jest.fn(),
  delete: jest.fn(),
}

const mockConfigService = {
  get: jest.fn(),
}

// describe() - 테스트 그룹. 보통 서비스 단위, 함수 단위로 묶음
describe('UserService', () => {
  let userService: UserService; // 테스트에서 사용할 Service 변수

  // beforeEach() - 각 테스트 실행 전에 매번 실행됨
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          // 모델 이름(User) 값으로 이 레포지토리의 레퍼런스를 가져올 수 있음(TypeOrmModule.forFeature([User,])와 같은 취급)
          provide: getRepositoryToken(User),
          useValue: mockUserRepository, // 근데 특정 값(mockUserRepository)으로 대체해라
          /**
           * @InjectRepository(User)
           * private readonly userRepository: Repository<User>,
           * user.service.ts에서 이런 요구사항이 있으면 mockUserRepository값으로 바꿔라
           */ 
        },
        {
          provide: ConfigService,
          useValue: mockConfigService, 
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  // it을 기반으로 테스트 실행할 때마다 mock의 기록들이 매번 초기화
  afterEach(()=>{
    jest.clearAllMocks(); // mock의 실행 기록 전부 삭제
  })

  it('should be defined', () => {
    expect(userService).toBeDefined();
  });

  describe("create", ()=>{
    it('should create a new user and return it', async ()=>{
      const createUserDto: CreateUserDto = {
        email: 'test@codefactory.ai',
        password: '123123',
      }
      
      const hashRounds = 10;
      const hashedPassword = 'ahfklehjrflkwajflaasdf';
      const result = {
        id: 1,
        email: createUserDto.email,
        password: hashedPassword,
      }

      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValueOnce(null);
      jest.spyOn(mockConfigService, 'get').mockReturnValue(hashRounds);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValueOnce(result);

      const createUser = await userService.create(createUserDto);

      expect(createUser).toEqual(result);
      expect(mockUserRepository.findOne).toHaveBeenNthCalledWith(1, {
        where:{
          email: createUserDto.email,
        }
      });
      expect(mockUserRepository.findOne).toHaveBeenNthCalledWith(2,  {
        where:{
          email: createUserDto.email,
        }
      });
      // 어떤 값으로든 뭔가 입력되서 get()이 불리는 것만 체크해도 되므로 expect.anything()을 넣어도 됨
      expect(mockConfigService.get).toHaveBeenCalledWith(expect.anything()); 
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, hashRounds);
      expect(mockUserRepository.save).toHaveBeenCalledWith({
        email: createUserDto.email,
        password: hashedPassword,
      });
    });

    it('should throw a BadRequestException if email already exists', ()=>{
      const createUserDto: CreateUserDto = {
        email: 'test@codefactory.ai',
        password: '123123',
      };

      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue({
        id: 1, 
        email: createUserDto.email,
      });

      expect(userService.create(createUserDto)).rejects.toThrow(BadRequestException);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where:{
          email: createUserDto.email,
        }
      })

    })
  })

  // findAll 함수 테스트 그룹
  describe("findAll", ()=>{
    // it()안의 테스트 제목에는 실제 일어나야 되는 행동을 적는 것을 추천
    it("should return all users", async ()=>{
      // 테스트 데이터
      const users = [
        {
          id: 1,
          email: 'test@codefactory.ai',
        },
      ];
      // Mock 반환값 설정. find() 호출되면 Promise.resolve(users)를 반환해라
      // 가짜 Repository 함수가 어떤 값을 반환할지 설정하는 코드
      mockUserRepository.find.mockResolvedValue(users)

      const result = await userService.findAll();

      expect(result).toEqual(users); // 반환 결과가 users와 같은지 확인(결과가 맞는지)
      expect(mockUserRepository.find).toHaveBeenCalled() // find()가 실제 호출되었는지 확인(내부 로직이 맞는지)
    });
  });

  describe("findOne", ()=>{
    it('should return a user by id', async ()=>{
      // Mock Repository가 반환할 가짜 사용자 데이터(의미있는 데이터는 아니므로 아무 값이나 넣어)
      const user = {id: 1, email: "test@codefactory.ai"};

      // spyOn() - 어떤 함수나 클래스를 스파잉해라
      // findOne() 호출되면 Promise.resolve(user) 반환
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(user); // 강사 선호. 아래 코드와 정확히 같음
      // mockUserRepository.findOne.mockResolvedValue(user);

      const result = await userService.findOne(1);

      expect(result).toEqual(user);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ // 정확한 파라미터로 Repository를 호출했는지
        // findOne()이 정확히 이 객체를 인자로 받아 호출됐는가?
        where: {
          id: 1, 
        },
      });
    });

    it('should throw a NotFoundException if user is not found', ()=>{
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(null);

      // findOne()은 async로 실행하므로 rejects 써야 함
      expect(userService.findOne(999)).rejects.toThrow(NotFoundException);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 999,
        },
      });
    });
  });

  describe("update", ()=>{
    it('should update a user if it exists and return the updated user', async ()=>{
      const updateUserDto: UpdateUserDto = {
        email: 'test@codefactory.ai',
        password: '123123',
      }
      const hashRounds = 10;
      const hashedPassword = 'ahfklehjrflkwajflaasdf';
      const user = {
        id: 1,
        email: updateUserDto.email,
      }

      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValueOnce(user);
      jest.spyOn(mockConfigService, 'get').mockReturnValue(hashRounds);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      jest.spyOn(mockUserRepository, 'update').mockResolvedValueOnce(undefined); // undefined - 뭘 받을 필요가 없기 때문
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValueOnce({
        ...user,
        password: hashedPassword,
      });

      const result = await userService.update(1, updateUserDto);

      expect(result).toEqual({
        ...user,
        password: hashedPassword,
      });
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 1,
        },
      })
      expect(bcrypt.hash).toHaveBeenCalledWith(updateUserDto.password, hashRounds);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        {id: 1},
        {
          ...updateUserDto,
          password: hashedPassword,
        }
      );
    });

    it('should throw a NotFoundException if user to update is not found', async ()=>{
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(null);

      const updateUserDto: UpdateUserDto = {
        email: 'test@codefactory.ai',
        password: '123123',
      };

      expect(userService.update(999, updateUserDto)).rejects.toThrow(NotFoundException);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 999,
        },
      });
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("remove", ()=>{
    it("should delete a user by id", async ()=>{
      const id = 999; // 그냥 테스트 데이터

      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue({
        id: 1, // 실제로 어떤 값이 나왔냐는 중요X. 그냥 이런 값이 반환됬다고 하자
      });

      const result = await userService.remove(id);

      expect(result).toEqual(id);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: {
          id,
        },
      });
    });

    it('should throw a NotFoundException if user to delete is not found', ()=>{
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(null);

      expect(userService.remove(999)).rejects.toThrow(NotFoundException);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 999,
        },
      });
    });
  });

});
