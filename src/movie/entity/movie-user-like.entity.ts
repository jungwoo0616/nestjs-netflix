import { Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { Movie } from "./movie.entity";
import { User } from "src/user/entities/user.entity";

@Entity()
export class MovieUserLike {
    @PrimaryColumn({
        name: 'movieId',
        type: 'int8',
    })
    @ManyToOne(
        () => Movie,
        (movie) => movie.likedUsers,
        {
            onDelete: 'CASCADE',
        }
    )
    movie!: Movie;

    @PrimaryColumn({
        name: 'userId',
        type: 'int8',
    })
    @ManyToOne(
        () => User,
        (user) => user.likedMovies,
        {
            onDelete: 'CASCADE',
        }
    )
    user!: User;

    @Column()
    isLike!: boolean;
} 

// 하나의 영화가 여러개의 MovieUserLike와 연결
// 하나의 유저가 여러개의 MovieUserLike와 연결

// 복합 PK 사용