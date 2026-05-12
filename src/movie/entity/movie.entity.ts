import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { BaseTable } from "../../common/entity/base-table.entity";
import { MovieDetail } from "./movie-detail.entity";
import { Director } from "src/director/entity/director.entity";
import { Genre } from "src/genre/entity/genre.entity";
import { MovieFilePipe } from "../pipe/moive-file.pipe";
import { Transform } from "class-transformer";
import { User } from "src/user/entities/user.entity";
import { MovieUserLike } from "./movie-user-like.entity";



@Entity()
export class Movie extends BaseTable{
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(
        () => User,
        (user) => user.createdMovies,
    )
    creator!: User;

    @Column({
        unique: true,
    })
    title!: string;

    @ManyToMany(
        ()=>Genre, 
        genre=>genre.movies,
    )
    @JoinTable()
    genres!: Genre[];

    @Column({
        default: 0,
    })
    likeCount!: number;

    @Column({
        default: 0,
    })
    dislikeCount!: number; 

    @OneToOne(
        () => MovieDetail,
        movieDetail => movieDetail.id,
        {
            cascade: true, // Movie데이터를 만들 때 MovieDetail데이터도 같이 만들어짐(기본 false)
            nullable: false,
        }
    )
    @JoinColumn()
    detail!: MovieDetail; 

    @Column()
    @Transform(({value}) => `http://localhost:3000/${value}`)
    movieFilePath!: string;

    @ManyToOne(
        () => Director,
        director => director.id,
        {
            cascade: true,
            nullable: false,
        }
    ) 
    director!: Director;

    @OneToMany(
        () => MovieUserLike,
        (mul) => mul.movie,
    )
    likedUsers!: MovieUserLike[];

}