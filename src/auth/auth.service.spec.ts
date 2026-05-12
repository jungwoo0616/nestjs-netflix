import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Role, User } from 'src/user/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager'
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockUserRepository = {
  findOne: jest.fn(),
}

const mockConfigService = {
  get: jest.fn(),
}

const mockJwtService = {
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
  decode: jest.fn(),
}

const mockCacheManager = {
  set: jest.fn(),
}

const mockUserService = {
  create: jest.fn(),
}

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: Repository<User>;
  let configService: ConfigService;
  let jwtService: JwtService;
  let cacheManager: Cache;
  let userService: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: CACHE_MANAGER, // @Inject(CACHE_MANAGER) 여기서 CACHE_MANAGER 이 키워드로 넣어주면 됨
          useValue: mockCacheManager,
        },
        {
          provide: UserService, // @Inject(CACHE_MANAGER) 여기서 CACHE_MANAGER 이 키워드로 넣어주면 됨
          useValue: mockUserService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    configService = module.get<ConfigService>(ConfigService);
    jwtService = module.get<JwtService>(JwtService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
    userService = module.get<UserService>(UserService);
  }); 

  afterEach(()=>{
    jest.clearAllMocks();
  })

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('tokenBlock', ()=>{
    it('should block a token', async ()=>{
      const token = 'token';
      const payload = {
        exp: (Math.floor(Date.now() / 1000)) + 60 // 어차피 mock이라 아무거나 넣어도 되긴 함
      };

      jest.spyOn(jwtService, 'decode').mockReturnValue(payload);

      await authService.tokenBlock(token);

      expect(jwtService.decode).toHaveBeenCalledWith(token);
      expect(cacheManager.set).toHaveBeenCalledWith(
        `BLOCK_TOKEN_${token}`,
        payload,
        expect.any(Number),
      );
    });
  });

  describe('parseBasicToken', ()=>{
    it('should parse a valid Basic Token', async ()=>{
      // 이건 진짜 인코딩된 거 넣어줘야 함 - parseBasicToken()에는 디펜던시가 없어서 실제 값으로 실행 가능하기 때문
      const rawToken = 'Basic dGVzdEBleGFtcGxlLmNvbToxMjM0NTY=';
      const result = authService.parseBasicToken(rawToken);
      
      const decode = {email: 'test@example.com', password: '123456'};

      expect(result).toEqual(decode);
    });

    // 토큰이 공백 기준으로 안띄어져 있는 경우
    it('should throw an error for invalid token format', async ()=>{
      const rawToken = 'InvalidTokenFormat';

      // promise가 아니라 일반 함수에서 그냥 에러 던질때는 expect()안에 콜백 함수로 실행해줘야 함(왜 그런지는 모른다고 함)
      // promise였으면 reject.toThrow()를 하면 됨
      expect(()=> authService.parseBasicToken(rawToken)).toThrow(BadRequestException);
    });

    // 토큰에 Basic이 없는 경우
    it('should throw an error for invalid Basic token format', async ()=>{
      const rawToken = 'Bearer InvalidTokenFormat';
      expect(()=> authService.parseBasicToken(rawToken)).toThrow(BadRequestException);
    });

    // 토큰이 :를 기준으로 2개로 쪼깨지지 않는 경우
    it('should throw an error for invalid Basic token format', async ()=>{
      const rawToken = 'basic a';
      expect(()=> authService.parseBasicToken(rawToken)).toThrow(BadRequestException);
    });
  });

  describe('parseBearerToken', ()=>{
    it('should parse a valid Bearer Token', async ()=>{
      const rawToken = 'Bearer token';
      const payload = {type: 'access'};

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      jest.spyOn(configService, 'get').mockReturnValue('secret');

      const result = await authService.parseBearerToken(rawToken, false);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('token', {
        secret: 'secret',
      });
      expect(result).toEqual(payload);
    });

    it('should throw a BadRequestException for invalid Bearer token format', async ()=>{
      const rawToken = 'a';
      expect(authService.parseBearerToken(rawToken, false)).rejects.toThrow(BadRequestException);
    });

    it('should throw a BadRequestException for token not starting with Bearer', async ()=>{
      const rawToken = 'Basic a';
      expect(authService.parseBearerToken(rawToken, false)).rejects.toThrow(BadRequestException);
    });

    it('should throw a BadRequestException if payload.type is not access but isRefreshToken parameter is false', async ()=>{
      const rawToken = 'Bearer a';

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        type: 'refresh',
      });

      expect(authService.parseBearerToken(rawToken, false)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw a BadRequestException if payload.type is not refresh but isRefreshToken parameter is true', async ()=>{
      const rawToken = 'Bearer a';

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        type: 'access',
      });
      expect(authService.parseBearerToken(rawToken, true)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', ()=>{
    it('should register a new user', async ()=>{
      const rawToken = 'basic abcd';
      const user = {
        email: 'test@ContextIdFactory.ai',
        password: '123123',
      }

      jest.spyOn(authService, 'parseBasicToken').mockReturnValue(user);
      jest.spyOn(mockUserService, 'create').mockResolvedValue(user);

      const result = await authService.register(rawToken);

      expect(authService.parseBasicToken).toHaveBeenCalledWith(rawToken);
      expect(userService.create).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });
  });

  describe('authenticate', ()=>{
    it('should authenticate a user with correct credentials', async ()=>{
      const email = 'test@codefactory.ai';
      const password = '123123';
      const user = {email, password: 'hashedpassword'};

      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockImplementation((a,b)=>true);

      const result = await authService.authenticate(email, password);

      expect(userRepository.findOne).toHaveBeenCalledWith({where: {email}});
      expect(bcrypt.compare).toHaveBeenCalledWith(password, user.password);
      expect(result).toEqual(user);
    });

    it('should throw an error for not existing user', async ()=>{
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(null);
      expect(authService.authenticate('test@example.com', 'password')).rejects.toThrow(BadRequestException);
    });

    it('should throw an error for incorrect password', async ()=>{
      const user = {email: 'test@codefactory.ai', password: 'hashedpassword'};
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockImplementation((a,b)=>false);
      
      await expect(authService.authenticate('test@example.com', 'password')).rejects.toThrow(BadRequestException);
    });
  });

  describe('issueToken', ()=>{
    const user = {id: 1, role: Role.user};
    const token = 'token';

    // 모킹을 이 안에 넣으면 매번 it()으로 테스트 실행시 새로 모킹해줌
    beforeEach(()=>{
      jest.spyOn(configService, 'get').mockReturnValue('secret');
      jest.spyOn(jwtService, 'signAsync').mockResolvedValueOnce(token);
    })

    it('should issue an access token', async ()=>{
      const result = await authService.issueToken(user as User, false);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {sub: user.id, type: 'access', role: user.role},
        {secret: 'secret', expiresIn: 600},
      );
      expect(result).toBe(token);
    });

    it('should issue a refresh token', async ()=>{
      const result = await authService.issueToken(user as User, true);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {sub: user.id, type: 'refresh', role: user.role},
        {secret: 'secret', expiresIn: '24h'},
      );
      expect(result).toBe(token);
    });
  });

  describe('login', ()=>{
    it('should login a user and return tokens', async ()=>{
      const rawToken = 'Basic asdf';
      const email = 'test@codefactory.ai';
      const password = '123123';
      const user = {id: 1, role: Role.user};

      jest.spyOn(authService, 'parseBasicToken').mockReturnValue({email, password});
      jest.spyOn(authService, 'authenticate').mockResolvedValue(user as User);
      jest.spyOn(authService, 'issueToken').mockResolvedValue('mocked.token');

      const result = await authService.login(rawToken);

      expect(authService.parseBasicToken).toHaveBeenCalledWith(rawToken);
      expect(authService.authenticate).toHaveBeenCalledWith(email, password);
      expect(authService.issueToken).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        refreshToken: 'mocked.token',
        accessToken: 'mocked.token',
      })
    });
  });


});