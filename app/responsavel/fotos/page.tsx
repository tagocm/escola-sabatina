import { getGuardianGalleryPhotos } from "@/app/actions/gallery";
import PageHeader from "@/components/ui/PageHeader";
import {
  emptyStateClass,
  gridCardClass,
  sectionTitleClass,
  stackedPageClass,
  statusBadgeClass,
} from "@/components/ui/design-system";
import { formatGalleryPhotoTagLabel, formatSabbathDateLabel } from "@/lib/gallery/sabbath";
import { requireGuardianPage } from "@/lib/auth/guards";
import { Camera, ImageOff, School, Tag } from "lucide-react";
import Image from "next/image";

interface GuardianGalleryPhoto {
  id: string;
  week_date: string;
  original_filename: string | null;
  tags: string[];
  caption: string | null;
  created_at: string;
  classes?: { name?: string | null } | { name?: string | null }[] | null;
}

function getClassName(photo: GuardianGalleryPhoto) {
  const classRecord = Array.isArray(photo.classes) ? photo.classes[0] : photo.classes;
  return classRecord?.name || "Classe";
}

function groupPhotosBySabbath(photos: GuardianGalleryPhoto[]) {
  return photos.reduce<Array<{ weekDate: string; photos: GuardianGalleryPhoto[] }>>((groups, photo) => {
    const group = groups.find((item) => item.weekDate === photo.week_date);
    if (group) {
      group.photos.push(photo);
      return groups;
    }

    return [...groups, { weekDate: photo.week_date, photos: [photo] }];
  }, []);
}

export default async function GuardianPhotosPage() {
  await requireGuardianPage();

  const photos = await getGuardianGalleryPhotos();
  const groups = groupPhotosBySabbath(photos as GuardianGalleryPhoto[]);

  return (
    <div className={stackedPageClass}>
      <PageHeader
        title="Fotos"
        subtitle="Registros compartilhados pela equipe da Escola Sabatina"
        backHref="/responsavel"
        backLabel="Voltar ao Portal"
      />

      {groups.length === 0 ? (
        <div className={emptyStateClass}>
          <div className="flex h-20 w-20 items-center justify-center border-4 border-foreground bg-background shadow-editorial-sm">
            <ImageOff className="h-10 w-10 stroke-[2] opacity-20" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-black uppercase tracking-tighter">Nenhuma foto disponível</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
              As fotos compartilhadas pela classe aparecerão aqui.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.weekDate} className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-6 w-2 border-2 border-foreground bg-es-blue" />
                <h2 className={sectionTitleClass}>{formatSabbathDateLabel(group.weekDate)}</h2>
                <div className="border-4 border-foreground bg-surface px-2 py-0.5 text-xs font-black shadow-editorial-sm">
                  {group.photos.length}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 md:gap-6">
                {group.photos.map((photo) => (
                  <article key={photo.id} className={gridCardClass}>
                    <div className="relative aspect-[4/3] w-full overflow-hidden border-b-4 border-foreground bg-background">
                      <Image
                        src={`/galeria/fotos/${photo.id}`}
                        alt={photo.caption || photo.tags.map(formatGalleryPhotoTagLabel).join(", ") || "Foto da classe"}
                        fill
                        unoptimized
                        sizes="(max-width: 768px) 100vw, 360px"
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    </div>

                    <div className="flex min-h-24 flex-col gap-3 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`${statusBadgeClass} bg-es-yellow`}>
                          <School className="h-3 w-3 stroke-[3]" />
                          {getClassName(photo)}
                        </span>
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
                          <Camera className="h-3.5 w-3.5 stroke-[3]" />
                          {new Date(photo.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {photo.tags.map((tag) => (
                          <span key={tag} className={`${statusBadgeClass} bg-es-blue`}>
                            <Tag className="h-3 w-3 stroke-[3]" />
                            {formatGalleryPhotoTagLabel(tag)}
                          </span>
                        ))}
                      </div>
                      {photo.caption ? (
                        <p className="line-clamp-2 text-[11px] font-bold uppercase leading-tight opacity-60">
                          {photo.caption}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
