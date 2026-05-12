import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

const mockedUserService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}

describe('UserController', () => {
  let userController: UserController;
  let userService: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        // UserService, // 이걸 사용하면 이 서비스 안에 있는 디펜던시들도 모킹을 해줘야 함..
        {
          provide: UserService,
          useValue: mockedUserService,
        }
      ], 
    }).compile();

    userController = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(userController).toBeDefined();
  });

  describe('create', ()=>{
    it('should return correct value', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@codefactory.ai',
        password: '123123',
      };

      const user = {
        id: 1,
        ...createUserDto,
        password: 'afdqw3eraewsfasf',
      }

      // 그냥 user라고 적으면 실제 반환하는 타입과 다르다고 나오는데 우리는 테스트 하는 거라 중요X
      // 그래서 그냥 user as User로 작성(실제 user가 Usre타입이 아니긴 하지만 user가 그대로 반환되느냐가 중요)
      jest.spyOn(userService, 'create').mockResolvedValue(user as User);

      const result = await userController.create(createUserDto);

      expect(userService.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(user);
    });
  });

  describe('findAll', ()=>{
    it('should return a list of users', async () => {
      const users = [
        {
          id: 1,
          email: 'test@codefactory.ai',
        },
        {
          id: 2,
          email: 'jest@codefactory.ai',
        },
      ]

      jest.spyOn(userService, 'findAll').mockResolvedValue(users as User[]);

      const result = await userController.findAll();

      expect(userService.create).toHaveBeenCalled();
      expect(result).toEqual(users);
    });
  });
  
  describe('findOne', ()=>{
    it('should return a single user', async () => {
      const user = {
          id: 1,
          email: 'test@codefactory.ai',
      };


      jest.spyOn(userService, 'findOne').mockResolvedValue(user as User);

      const result = await userController.findOne(1);

      expect(userService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(user);
    });
  });

  describe('update', ()=>{
    it('should return the updated user', async () => {
      const id = 1;
      const updateUserDto: UpdateUserDto = {
        email: 'admin@codefactory.ai',
      }
      const user = {
          id: 1,
          ...updateUserDto,
      };


      jest.spyOn(userService, 'update').mockResolvedValue(user as User);

      const result = await userController.update(1, updateUserDto);

      expect(userService.update).toHaveBeenCalledWith(1, updateUserDto);
      expect(result).toEqual(user);
    });
  });

  describe('remove', ()=>{
    it('should return a single user', async () => {
      const id = 1
      
      jest.spyOn(userService, 'remove').mockResolvedValue(id);

      const result = await userController.remove(id);

      expect(userService.remove).toHaveBeenCalledWith(id);
      expect(result).toEqual(id);
    });
  });
});
